import EventEmitter from 'eventemitter3';
import { Reconnex } from 'reconnex';
import { LogLevel, Logger } from './lib/Logger';
import { payloads, pubsubWSURL } from './lib/twitch/ws';
import { FMCategory, FMLiveData, FMPlatforms } from './lib/types';
import { RecursivePartial, sleep } from './lib/utils';
import { FetchTwitchData, fetchTwitchDataFN, getTwitchPlaylist } from './lib/twitch/fetchTwitchData';
import { Queue } from './lib/Queue';
import { IBroadcastChange, IStatusChangeProps, TwitchWSMessage } from './lib/twitch/types';
import { StreamUtils } from './lib/Stream';
import fetchVideo, { Youtube } from './lib/youtube/helpers';


interface ClientOptions {
	log?: Logger;
	youtube?: {
		intervalChecker: number
		headers?: HeadersInit
	}
	twitch?: {
		headers?: HeadersInit
	}
}

export type FlowMonitorEvents = {
	streamUp: [channel: Omit<Channel, 'streams'>, vod: Stream]
	streamDown: [channel: Omit<Channel, 'streams'>, vod: Stream]
	viewCount: [channel: Omit<Channel, 'streams'>, vod: Stream, count: number]
	category: [channel: Omit<Channel, 'streams'>, vod: Stream, newcategory: FMCategory]
	title: [channel: Omit<Channel, 'streams'>, vod: Stream, newTitle: string]
	thumbnail: [channel: Omit<Channel, 'streams'>, vod: Stream, thumbnail: string]
	twitchSocketOpen: [uri: string];
	twitchSocketClose: [code: number, reason?: string];
	connected: [channel: Channel];
	disconnected: [channel: Channel];
	close: [code: number, reason: string, wasClean: boolean];
	closeTwitch: [reason: string];
	error: [event: string];
};

type Stream = Omit<FMLiveData, 'event'>
type Streams = Map<string, Stream>
type Channel = {
	monitoring?: boolean,
	platform: FMPlatforms
	username: string
	userId: string
	streams: Streams
}
type Channels = Map<FMPlatforms, Map<string, Partial<Channel>>>
export class FlowMonitor extends EventEmitter<FlowMonitorEvents> {
	private log?: Logger;
	private queue = new Queue({ concurrency: 1 });
	public channels: Channels
	private youtubeCheckerEnabled = false
	private twitchReconnex
	private youtube: NonNullable<ClientOptions['youtube']>
	private twitch: ClientOptions['twitch']
	constructor(opts: ClientOptions = {}) {
		super()
		this.log = opts.log ?? new Logger(LogLevel.Fatal);
		this.channels = new Map()
		this.channels.set('twitch', new Map())
		this.channels.set('youtube', new Map())
		this.twitch = opts.twitch || {}
		this.twitchReconnex = new Reconnex({
			url: pubsubWSURL,
			ping: {
				data: '{"type":"PING"}',
				interval: 3 * 60 * 1000
			},
			reconnect: {
				maxAttempts: Infinity
			}
		})
		this.youtube = {
			headers: opts.youtube?.headers || new Headers(),
			intervalChecker: opts.youtube?.intervalChecker || 5_000
		}
		this.twitchReconnex.on('close', (code, reason) => {
			this.emit('twitchSocketClose', code, reason?.toString())
		})
		this.twitchReconnex.on('open', (url) => {
			this.emit('twitchSocketOpen', url)
		})
		this.twitchReconnex.on('text', async (text) => {

			const wsMessage: TwitchWSMessage = JSON.parse(text || '{}')
			if (wsMessage.type === "MESSAGE") {
				const { topic, message } = wsMessage.data
				const [payload, userId] = topic.split(".")
				const channel = this.getChannelByUID('twitch', userId)
				if (!channel) return
				const userLiveData = channel.streams.values().next().value as Stream
				if (payload == "video-playback-by-id") {
					const status: IStatusChangeProps = JSON.parse(message)
					if (status.type == 'stream-up') {
						const waitForStreamId = async () => {
							const success = await this.twitchStreamUp(channel.username)
							if (!success) setTimeout(waitForStreamId, 1_000)
						}
						waitForStreamId()
					}
					if (status.type == 'stream-down') {
						this.updateStreamData('twitch', channel?.username, userLiveData?.vodId, { ...userLiveData, started_at: 'nullx' })
					} else if (status.type == 'viewcount' && userLiveData) {
						userLiveData?.vodId && this.updateStreamData('twitch', channel?.username, userLiveData?.vodId, { ...userLiveData, viewers: status.viewers })
					}
				} else if (payload == 'broadcast-settings-update') {
					const { game, game_id, old_game, old_status, status, }: IBroadcastChange = JSON.parse(message)
					if (game !== old_game) {
						const category = {
							id: String(game_id),
							image: `https://static-cdn.jtvnw.net/ttv-boxart/${game_id}-144x192.jpg`,
							name: game
						} satisfies FMCategory
						userLiveData?.vodId && this.pushLiveCategory('twitch', channel?.username, userLiveData.vodId, category)
					}
					if (status !== old_status) {
						userLiveData?.vodId && this.updateStreamData('twitch', channel?.username, userLiveData.vodId, { ...userLiveData, title: status })
					}
				}


			}
		})
	}

	private pushLiveCategory(platform: FMPlatforms, channel: string, vodId: string, category: FMCategory) {
		const userLiveData = this.getVodData(platform, channel, vodId)
		if (userLiveData) {
			userLiveData.category.push(category)
			this.updateStreamData(platform, channel, vodId, userLiveData)
		}
	}
	private updateStreamData(platform: FMPlatforms, channel: string, vodId: string, data: Stream) {
		const oldData = this.getVodData(platform, channel, vodId)
		const newData = { ...oldData, ...data }
		this.channels.get(platform)?.get(channel)!?.streams!.set(vodId, newData)
		const dataSave = this.getChannel(platform, channel)!
		if (!dataSave) return
		const { streams, ...channelData } = dataSave
		if (oldData) {

			if (data.started_at == 'nullx') {
				this.channels.get(platform)?.get(channel)!.streams!.delete(vodId)
				this.emit('streamDown', channelData, oldData!)
				return
			}
			if (oldData.title !== data.title) {
				this.emit('title', channelData, streams.get(vodId)!, data.title)
			}
			if (oldData.viewers !== data.viewers) {
				this.emit('viewCount', channelData, streams.get(vodId)!, data.viewers)
			}
			if (oldData.category.length < data.category.length) {
				this.emit('category', channelData, streams.get(vodId)!, data.category.pop()!)
			}
			if (oldData.thumbnail !== data.thumbnail) {
				this.emit('thumbnail', channelData, streams.get(vodId)!, data.thumbnail)
			}
			return
		}
		this.emit('streamUp', channelData, streams.get(vodId)!)

	}

	public closeTwitch(reason?: string) {
		this.twitchReconnex.disconnect(reason)
		this.twitchReconnex?.on('close', (_code, reason) => {
			this.emit('closeTwitch', reason?.toString() || '')
		})
	}

	private updateChannel(platform: FMPlatforms, channel: string, data: RecursivePartial<Channel>) {
		this.channels.get(platform)?.set(channel, {
			...this.channels.get(platform)?.get(channel) as Channel,
			...data as Channel
		})
	}

	private async connectTwWebsocket() {
		if (!this.twitchReconnex.isConnected()) {
			this.twitchReconnex.open()
			await this.twitchReconnex?.waitTwitchWSConnected()
		}
	}

	public getChannelByUID(platform: FMPlatforms, userId: string): Channel | null {
		let ret: Channel | null = null
		this.channels.get(platform)!.forEach(channel => {
			if (channel.userId == userId) ret = channel as Channel
		})
		return ret
	}
	public getVodData(platform: FMPlatforms, channel: string, vodId: string) {
		return this.channels.get(platform)?.get(channel)?.streams?.get(vodId)
	}
	public getChannel(platform: FMPlatforms, channel: string) {
		return this.channels.get(platform)?.get(channel) as Channel | undefined
	}
	private subscribeTwitchChannel(userId: string | number) {
		this.twitchReconnex?.sendOnConnect(payloads.gameBroadcaster(String(userId), 'LISTEN'))
		this.twitchReconnex?.sendOnConnect(payloads.videoPlayBack(String(userId), 'LISTEN'))
	}
	private unSubscribeTwitchChannel(userId: string | number) {
		this.twitchReconnex?.removeSendOnConnect(payloads.gameBroadcaster(String(userId), 'LISTEN'))
		this.twitchReconnex?.removeSendOnConnect(payloads.videoPlayBack(String(userId), 'LISTEN'))
		this.twitchReconnex?.send(payloads.gameBroadcaster(String(userId), 'UNLISTEN'))
		this.twitchReconnex?.send(payloads.videoPlayBack(String(userId), 'UNLISTEN'))
	}


	private async fetchTwitchData(channel: string) {
		return await fetchTwitchDataFN(channel, this.twitch?.headers)
	}
	private async twitchStreamUp(channel: string) {
		const data = await this.fetchTwitchData(channel) as FetchTwitchData
		if (data.streamId == 0) return false;
		const id = StreamUtils.generateUUID()
		const { categoryId, categoryImage, categoryName, login, m3u8Url, started_at, streamId, thumbnail, title, userId, viewersCount } = data;
		const liveData = {
			id,
			channel: login,
			platform: 'twitch',
			started_at: started_at,
			thumbnail: thumbnail,
			title: title,
			userId: String(userId),
			viewers: viewersCount || 0,
			vodId: String(streamId),
			category: [{
				id: String(categoryId),
				image: categoryImage,
				name: categoryName
			}],
			m3u8Url: m3u8Url,
			chatEnabled: true
		} satisfies Stream;
		this.updateStreamData('twitch', channel, String(data.streamId), liveData);
		return true

	}

	private onCatch(e: Error) {
		console.log(e)
		console.log(e.name)
	}

	/**
	 * Connect a channel by name. The channel name will be normalized.
	 */
	public async connect(channel: string, platform: FMPlatforms): Promise<Channel | void> {
		this.queue.push(async (cb) => {
			channel = StreamUtils.normalizeName(channel)
			const data = this.channels.get(platform)?.get(channel)
			let userId
			if (data) {
				// throw error already connected?
				return data
			}

			if (platform == 'twitch') {
				await this.connectTwWebsocket()
				const data = await this.fetchTwitchData(channel)
				if (data.userId == 0 || !data.userId) {
					// @TODO throw error?
					// throw new Error(`${channel} not found`)
					return
				}
				userId = String(data.userId)
				this.subscribeTwitchChannel(data.userId)
				if (data.started_at !== null) this.twitchStreamUp(channel)
			} else if (platform == 'youtube') {
				const exists = await Youtube.channelExists(channel, this.youtube?.headers).catch(this.onCatch)
				if (!exists) {
					// @TODO throw error?
					// throw new Error(`${channel} not found`)
					return
				}
				userId = exists
				if (!this.youtubeCheckerEnabled) {
					this.youtubeCheckerEnabled = true
					setTimeout(() => this.youtubeChecker(), 1_000)
				}
			}
			this.updateChannel(platform, channel, {
				monitoring: false,
				username: channel,
				userId,
				platform: platform,
				streams: new Map()
			})
			this.emit('connected', this.getChannel(platform, channel)!)
			cb(null, true)
		}, { priority: 0, id: channel }).then(res => {

		})
	}

	public async twitchPlaylist(channel: string) {
		return await getTwitchPlaylist(channel, this.twitch?.headers)
	}
	public async disconnect(channel: string, platform: FMPlatforms) {
		this.queue.push(async cb => {
			const data = this.channels.get(platform)?.get(channel)
			if (data && data?.userId && data.username) {
				this.channels.get(platform)?.delete(channel)
				this.emit('disconnected', data as Channel)
				if (platform == 'twitch') {
					this.unSubscribeTwitchChannel(data.userId)
				}
			} else {
				// @TODO throw error?
				// throw new Error(`${channel} not connected`)
				return
			}
			cb(null, true)
		}, { priority: 0, id: channel })
	}

	public close() {
		this.channels.get('twitch')?.forEach(channel => {
			this.unSubscribeTwitchChannel(channel.userId!)
		})
		this.channels = new Map()
		this.channels.set('twitch', new Map())
		this.channels.set('youtube', new Map())
		this.twitchReconnex.disconnect()
	}

	private async fetchYoutubeChannel(channel: Channel) {
		const streams = await Youtube.fetchStreams(channel.username, this.youtube?.headers)
		for (const stream of streams) {
			const vod = this.getVodData('youtube', channel.username, stream.videoId)
			if (!vod) {
				await this.fetchYoutubeVideo(stream.videoId, channel.username)
			}
		}
	}
	private async fetchYoutubeVideo(videoId: string, channelName: string = '') {
		const res = await fetchVideo(videoId, this.youtube?.headers)
		const { reason, status, title, category, live, code } = res
		// console.log(res)
		if (!code || code !== 'network_error' && channelName.length > 0) {
			const channel = this.getChannel('youtube', channelName)
			const userLiveData = channel?.streams.get(videoId)
			if (userLiveData && channel) {
				if (reason || status == 'ERROR') {
					this.updateStreamData('youtube', channel.username, userLiveData.vodId, { ...userLiveData, started_at: 'nullx' })
				} else {
					if (live?.viewers && userLiveData?.viewers !== live.viewers) {
						this.updateStreamData('youtube', channel.username, userLiveData.vodId, { ...userLiveData, viewers: live.viewers })
					} else if (title && title !== userLiveData.title) {
						this.updateStreamData('youtube', channel.username, userLiveData.vodId, { ...userLiveData, title: title })
						// emit title changed event
					} else if (category?.name && category.name !== userLiveData.category.pop()?.name) {
						this.pushLiveCategory('youtube', channel.username, userLiveData.vodId, category)
					}
				}
			} else {
				if (!reason && status !== 'ERROR' && live?.isLiveNow && channel) {
					const id = StreamUtils.generateUUID()
					const { channelId, live, title, thumbnails } = res
					const liveData = {
						id,
						channel: channel.username,
						platform: 'youtube',
						started_at: live?.startTimestamp.toString()!,
						thumbnail: thumbnails?.pop()?.url.toString()!,
						title: title!,
						userId: channelId!,
						viewers: live?.viewers || 0,
						vodId: videoId,
						chatEnabled: live?.chatEnabled!,
						category: [{
							id: category?.id!,
							image: category?.image!,
							name: category?.name!
						}],
						m3u8Url: live?.dashManifestUrl.toString()
					} satisfies Stream;
					this.updateStreamData('youtube', channel.username, videoId, liveData);
				}
			}
		}
		return res
	}

	private async youtubeChecker() {
		if (this.youtubeCheckerEnabled) {
			if (this.channels.get('youtube')?.size == 0) {
				this.youtubeCheckerEnabled = false
				return
			}
			// check if has youtube channels connected
			for await (const [_id, channel] of this.channels.get('youtube')!) {
				await this.fetchYoutubeChannel(channel as Channel)
				const streams = Array.from(channel.streams?.values()!)
				for await (const stream of streams) {
					await sleep(this.youtube.intervalChecker)
					await this.fetchYoutubeVideo(stream.vodId, channel.username)
				}

			}
			setTimeout(() => this.youtubeChecker(), this.youtube?.intervalChecker)
		}
	}

	public async fetchTwitch(channel: string) {
		const data = await this.fetchTwitchData(channel) as FetchTwitchData
		const vod = this.getVodData('twitch', channel, String(data.streamId))
		if (vod && vod?.vodId) {
			if (data.started_at !== null) {
				const { m3u8Url, thumbnail, title } = data;
				const liveData = {
					...vod,
					thumbnail: thumbnail,
					title: title,
					m3u8Url: m3u8Url
				} satisfies Stream;
				this.updateStreamData('twitch', channel, String(data.streamId), liveData);
			} else {
				this.updateStreamData('twitch', channel, vod.vodId, { ...vod!, started_at: 'nullx' })
			}
		} else {
			const channelConnected = this.getChannel('twitch', channel)
			if (data?.started_at !== null && channelConnected?.username) this.twitchStreamUp(channel)
		}
		return data

	}

	public async fetchYoutube(videoId: string, channel?: string) {
		return this.fetchYoutubeVideo(videoId, channel)
	}

}