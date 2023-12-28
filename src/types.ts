
type CommonOptions = {
  platform: LMPlatforms
  channel: string
}

export type ConnectedChannels = CommonOptions & {
  checkerConnected?: boolean
  userId?: string
}

export type FlowMonitorOtions = {
  youtube?: {
    intervalChecker?: number
    headers?: HeadersInit
  }
  twitch?: {
    headers?: HeadersInit
  }
}

export type ConnectOptions = CommonOptions


export type LMEventTypes = 'streamUp' | 'streamDown' | 'viewerCount' | 'title' | 'category'
export type LMPlatforms = 'twitch' | 'youtube' | 'kick'
export type LMCategory = {
  image: string
  name: string
  id: string
}

export type LMLiveData = {
  event?: LMEventTypes
  platform: LMPlatforms
  channel: string
  title: string
  category: LMCategory
  viewers: number
  thumbnail: string
  started_at: string
  vodId: string
  m3u8Url?: string
}

export type LiveDataChangeEvent = (liveData: LMLiveData) => void
export type NewChannelEvent = (channel: { name: string, platform: LMPlatforms }) => void
export type disconnectChannel = (channel: { name: string, platform: LMPlatforms }) => void

export type FlowMonitorEvents = {
  streamUp: LiveDataChangeEvent
  streamDown: LiveDataChangeEvent
  viewerCount: LiveDataChangeEvent
  title: LiveDataChangeEvent
  category: LiveDataChangeEvent
  newChannel: NewChannelEvent
  disconnectChannel: NewChannelEvent
  twitchError: (error: string, status: number, message: string) => void
  close: () => void
  start: () => void
}


export type FetchError = {
  error?: string,
  code?: 'network_error'
}