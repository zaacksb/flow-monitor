import AsyncLock from 'async-lock';
import { EventEmitter } from 'events';
import { Reconnex } from 'reconnex';
import { fetchTwitchData } from './fetchTwitchData';
import { TwitchPayload, payloads, pubsubWSURL } from './twitchws';
import { ConnectOptions, ConnectedChannels, FlowMonitorEvents, FlowMonitorOtions, LMEventTypes, LMLiveData, LMPlatforms } from './types';
import { IBroadcastChange, IStatusChangeProps, TwitchWSMessage } from './types/twitchws';
import { sleep } from './utils';
import fetchVideo from './youtube/helpers';
export class FlowMonitor extends EventEmitter {
  #lock = new AsyncLock()
  #liveData: { [key: string]: LMLiveData } = {}
  #connectedChannels: ConnectedChannels[] = []

  #youtubeChannelsChecker: { user: string, live: boolean }[] = []
  #youtubeIntervalChecker: number = 5 * 1000
  #twitchHeaders? = {}
  #youtubehHeaders? = {}
  #youtubeCheckerConnected = false

  #twitchWSConnected = false
  #startedChecker = false

  #zTwSocket = new Reconnex({
    url: pubsubWSURL,
    ping: {
      data: '{"type":"PING"}',
      interval: 3 * 60 * 1000
    },
    reconnect: {
      maxAttempts: -1
    }
  })
  constructor({ youtube, twitch }: FlowMonitorOtions = {}) {
    super()
    this.#youtubeIntervalChecker = youtube?.intervalChecker || 5 * 1000
    this.#twitchHeaders = twitch?.headers
    this.#youtubehHeaders = youtube?.headers

  }
  on<E extends keyof FlowMonitorEvents>(event: E, listener: FlowMonitorEvents[E]): this {
    return super.on(event, listener);
  }

  private setCheckerConnected(channel: string, connected: boolean, platform: LMPlatforms) {
    this.#lock.acquire('lm', () => {
      this.#connectedChannels = this.#connectedChannels.filter(chn => {
        if (chn.channel == channel && chn.platform == platform) {
          chn.checkerConnected = connected
        }
        return chn
      })
    })
  }

  public connect(channel: string, platform: LMPlatforms) {
    const channelIsConnected = this.#connectedChannels.find(chn => chn.channel == channel && chn.platform == platform)
    if (!channelIsConnected) {
      this.emit('newChannel', { name: channel, platform })
      this.#connectedChannels.push({
        channel: formatChannelName(channel),
        platform
      })
    }
  }
  public livedata(channel: string, platform: LMPlatforms): LMLiveData | undefined {
    return this.#liveData[`${channel}.${platform}`]
  }
  public disconnect(channel: string, platform: LMPlatforms) {
    channel = formatChannelName(channel)
    const channelIsConnected = this.#connectedChannels.find(chn => chn.channel == channel && chn.platform == platform)
    if (channelIsConnected) {
      this.#lock.acquire('lm', () => {
        this.#connectedChannels = this.#connectedChannels.filter(chn => chn.channel !== channel && chn.platform !== platform)
        if (channelIsConnected.checkerConnected) {
          if (channelIsConnected.platform == 'twitch') {
            this.twitchSubUnsubWSEvents({
              channel: channel,
              platform,
              event: 'UNLISTEN'
            })
          } else if (channelIsConnected.platform == 'youtube') {
            this.emit('disconnectChannel', {
              name: channelIsConnected.channel,
              platform: channelIsConnected.platform
            })
            this.#youtubeChannelsChecker = this.#youtubeChannelsChecker.filter(({ user }) => user !== channelIsConnected.channel)
            delete this.#liveData[`${channelIsConnected.channel}.${channelIsConnected.platform}`]
          }
        }
      })
    }
  }

  private emitLiveData({ category, channel, platform, started_at, thumbnail, title, viewers, vodId, event, m3u8Url, id, userId }: LMLiveData & { event: LMEventTypes }) {
    this.emit(event, {
      category: {
        id: category?.id,
        image: category?.image,
        name: category?.name
      },
      channel,
      userId,
      platform,
      started_at: started_at,
      thumbnail: thumbnail,
      title,
      viewers: viewers,
      vodId: vodId,
      m3u8Url,
      id
    } as LMLiveData)
  }


  private async connectTwWebsocket() {
    this.#twitchWSConnected = true


    if (!this.#zTwSocket.isConnected()) this.#zTwSocket.open()
  }

  public start() {
    if (this.#startedChecker) return
    this.#startedChecker = true
    this.emit('start')
    this.addTwitchListeners()
    let cInterval = setInterval(async () => {
      const channels = this.#connectedChannels.filter(chn => !chn.checkerConnected)
      channels.forEach(async ({ channel, platform, checkerConnected }) => {
        if (platform == 'twitch') {
          if (!this.#zTwSocket?.isConnected()) {
            this.connectTwWebsocket()
          }
          if (!checkerConnected) {
            this.setCheckerConnected(channel, true, platform)
            this.#zTwSocket?.waitTwitchWSConnected().then(() => {
              this.twitchSubUnsubWSEvents({
                channel: channel,
                platform: platform,
                event: 'LISTEN'
              })
            })
          }
        } else if (platform == 'youtube') {
          if (!this.#youtubeCheckerConnected) {
            this.#youtubeCheckerConnected = true
            this.youtubeChecker()
          }
          if (!checkerConnected) {
            this.setCheckerConnected(channel, true, platform)

            const ytCheckerConnected = this.#youtubeChannelsChecker.find(({ user }) => user == channel)
            if (!ytCheckerConnected) {
              this.#youtubeChannelsChecker.push({
                user: channel,
                live: false
              })
            }
          }
        }



      })
      if (!this.#startedChecker) clearInterval(cInterval)
    }, 100)
  }

  public close() {
    this.emit('close')
    this.#startedChecker = false
    this.#liveData = {}
    this.#twitchWSConnected = false
    this.#zTwSocket?.disconnect()
    this.#youtubeChannelsChecker = []
  }

  private async twitchSubUnsubWSEvents({ channel, platform, event, streamDown }: { event: TwitchPayload, streamDown?: boolean } & Pick<ConnectOptions, 'channel' | 'platform'>) {
    const { login, categoryId, categoryImage, categoryName, started_at, streamId, title, userId, viewersCount, thumbnail, m3u8Url, code, error, message, status } = await fetchTwitchData(channel, this.#twitchHeaders)
    if (error) {
      this.emit('twitchError', error, status, message)
    }

    if (login) {
      if (!streamDown) {
        if (event == 'LISTEN') {
          this.#zTwSocket?.sendOnConnect(payloads.gameBroadcaster(String(userId), event))
          this.#zTwSocket?.sendOnConnect(payloads.videoPlayBack(String(userId), event))
        } else {
          this.#zTwSocket?.send(payloads.gameBroadcaster(String(userId), event))
          this.#zTwSocket?.send(payloads.videoPlayBack(String(userId), event))

          this.#zTwSocket?.removeSendOnConnect(payloads.gameBroadcaster(String(userId), 'LISTEN'))
          this.#zTwSocket?.removeSendOnConnect(payloads.videoPlayBack(String(userId), 'LISTEN'))
        }
      }
      const channelData = {
        category: {
          id: String(categoryId),
          image: categoryImage,
          name: categoryName
        },
        started_at,
        vodId: String(streamId),
        title: String(title),
        viewers: viewersCount || 0,
        channel,
        userId: String(userId || channel),
        platform,
        thumbnail,
        m3u8Url,
        id: generateUUID()
      } as LMLiveData

      Object.assign(this.#liveData, { [`${channel}.${platform}`]: channelData });
      this.#lock.acquire('lm', () => {
        this.#connectedChannels = this.#connectedChannels.map(chn => {
          if (chn.channel == channel) {
            chn.userId = String(userId)
          }
          return chn
        })
      })
      if (streamId && streamId > 0 && event !== 'UNLISTEN') this.emitLiveData({
        event: 'streamUp',
        ...channelData
      })
      if (event == 'UNLISTEN') {
        delete this.#liveData[`${channel}.${platform}`]
      }
      if (streamDown) {
        this.emitLiveData({
          event: 'streamDown',
          ...channelData
        })
        return
      }

      if (event == 'UNLISTEN') {
        this.emit('disconnectChannel', {
          name: login,
          platform: 'twitch'
        })
      }
    }
  }
  private getTwChannelById(userId: string) {
    return this.#connectedChannels.find(chn => chn.userId === userId)
  }

  private addTwitchListeners() {
    this.#zTwSocket.on('text', (text) => {


      const wsMessage: TwitchWSMessage = JSON.parse(text.toString()) || {}
      if (wsMessage.type === "MESSAGE") {
        const { topic, message } = wsMessage.data
        const [payload, userId] = topic.split(".")
        const channel = this.getTwChannelById(userId)
        const userLiveData = this.#liveData[`${channel?.channel}.${channel?.platform}`]
        if (payload == "video-playback-by-id") {
          const status: IStatusChangeProps = JSON.parse(message)
          if (status.type == 'stream-up') {
            let timeoutStreamId = setTimeout(() => {
              clearInterval(waitForStreamId)
            }, 10 * 1000)

            let waitForStreamId = setInterval(async () => {
              const { login, categoryId, categoryImage, categoryName, started_at, streamId, title, viewersCount, thumbnail, m3u8Url } = await fetchTwitchData(String(channel?.channel))
              if (started_at && m3u8Url) {
                clearTimeout(timeoutStreamId)
                clearInterval(waitForStreamId)
                const channelData = {
                  category: {
                    id: String(categoryId),
                    image: categoryImage,
                    name: categoryName
                  },
                  started_at,
                  vodId: String(streamId),
                  title: String(title),
                  viewers: viewersCount || 0,
                  channel: login,
                  userId: String(userId || channel),
                  platform: channel?.platform,
                  thumbnail,
                  m3u8Url,
                  id: generateUUID()
                } as LMLiveData
                Object.assign(this.#liveData, { [`${login}.${channel?.platform}`]: channelData });
                this.emitLiveData({
                  event: 'streamUp',
                  ...channelData
                })
              }

            }, 1000)

          }
          if (status.type == 'stream-down' && channel) {
            this.twitchSubUnsubWSEvents({
              channel: channel.channel,
              platform: channel.platform,
              event: 'UNLISTEN',
              streamDown: true
            })
          } else if (status.type == 'viewcount' && channel && userLiveData) {
            const { viewers, channel: channelName } = this.#liveData[`${channel.channel}.${channel.platform}`]
            if (viewers !== status.viewers) {
              Object.assign(this.#liveData, {
                [`${channelName}.${channel.platform}`]: {
                  ...this.#liveData[`${channel.channel}.${channel.platform}`],
                  viewers: status.viewers
                }
              })
              this.emitLiveData({
                event: 'viewerCount',
                ...this.#liveData[`${channel.channel}.${channel.platform}`]
              })
            }
          }
        } else if (payload == 'broadcast-settings-update' && channel && userLiveData) {
          const { channel: channelName, game, game_id, old_game, old_status, status }: IBroadcastChange = JSON.parse(message)


          if (game !== old_game) {
            Object.assign(this.#liveData, {
              [`${channelName}.${channel.platform}`]: {
                ...this.#liveData[`${channel.channel}.${channel.platform}`],
                category: {
                  id: String(game_id),
                  image: `https://static-cdn.jtvnw.net/ttv-boxart/${game_id}-144x192.jpg`,
                  name: game
                }
              }
            })
            this.emitLiveData({
              event: 'category',
              ...this.#liveData[`${channelName}.${channel.platform}`],
            })
          }
          if (status !== old_status) {
            Object.assign(this.#liveData, {
              [`${channelName}.${channel.platform}`]: {
                ...this.#liveData[`${channel.channel}.${channel.platform}`],
                title: status
              }
            })
            this.emitLiveData({
              event: 'title',
              ...this.#liveData[`${channelName}.${channel.platform}`]
            })
          }
        }


      }
    })
  }

  private async youtubeChecker() {
    for (const channel of this.#youtubeChannelsChecker) {
      if (channel.live) {
        const { reason, status, title, category, live, videoId, error, code } = await fetchVideo(channel.user, this.#youtubehHeaders)
        if (!code || code !== 'network_error') {
          const currentData = this.#liveData[`${channel.user}.youtube`]
          if (reason || status == 'ERROR' || (videoId && videoId !== currentData.vodId)) {
            this.emitLiveData({
              event: 'streamDown',
              ...currentData
            })
            delete this.#liveData[`${channel.user}.youtube`]
            this.#lock.acquire('lm', () => {
              this.#youtubeChannelsChecker = this.#youtubeChannelsChecker.filter((chn) => {
                if (chn.user == chn.user) {
                  chn.live = false
                }
                return chn
              })
            })
          } else {
            if (live?.viewers && currentData.viewers !== live.viewers) {
              const channelData = {
                ...currentData,
                viewers: live.viewers
              } as LMLiveData

              Object.assign(this.#liveData, { [`${channel.user}.youtube`]: channelData });
              this.emitLiveData({
                event: 'viewerCount',
                ...channelData
              })
            } else if (title && title !== currentData.title) {
              const channelData = {
                ...currentData,
                title
              } as LMLiveData

              Object.assign(this.#liveData, { [`${channel.user}.youtube`]: channelData });
              this.emitLiveData({
                event: 'title',
                ...channelData
              })
            } else if (category?.name && category.name !== currentData.category.name) {
              const channelData = {
                ...currentData,
                category
              } as LMLiveData

              Object.assign(this.#liveData, { [`${channel.user}.youtube`]: channelData });
              this.emitLiveData({
                event: 'category',
                ...channelData
              })
            }
          }
        }
      } else {
        const { category, live, title, reason, status, videoId, error, code, channelId } = await fetchVideo(channel.user)
        if (!code || code !== 'network_error') {
          if (live?.isLiveNow && !reason && status !== 'ERROR') {
            const channelData = {
              category,
              started_at: String(live?.startTimestamp),
              vodId: videoId,
              title,
              viewers: live?.viewers || 0,
              channel: channel.user,
              userId: channelId,
              platform: 'youtube',
              thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
              m3u8Url: `${live?.hlsManifestUrl}`,
              id: generateUUID()
            } as LMLiveData

            Object.assign(this.#liveData, { [`${channel.user}.youtube`]: channelData });
            this.emitLiveData({
              event: 'streamUp',
              ...channelData
            })
            this.#lock.acquire('lm', () => {
              this.#youtubeChannelsChecker = this.#youtubeChannelsChecker.filter(chn => {
                if (chn.user == channel.user) {
                  chn.live = true
                }
                return chn
              })
            })
          }
        }
      }
    }
    await sleep(this.#youtubeIntervalChecker)
    if (!this.#youtubeCheckerConnected) return
    this.youtubeChecker()
  }


}

function formatChannelName(name: string) {
  return name.replace('@', '')
}
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}