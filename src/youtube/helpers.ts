import { FetchError, LMCategory } from '../types'
import { findKey, getStr } from '../utils'
import { extractStoryboard } from './storyBoard'

type VideoFormats = {
  itag: number
  url: URL
  mimeType: string
  bitrate: number
  width: number
  height: number
  lastModified: string
  contentLength: string
  initRange?: {
    start: string
    end: string
  },
  indexRange?: {
    start: string
    end: string
  },
  quality: "tiny" | "small" | "medium" | "hd720" | "hd1080" | "large"
  fps: number
  qualityLabel: "144p" | "240p" | "360p" | "480p" | "720p" | "720p60" | "1080p60"
  projectionType: "RECTANGULAR",
  averageBitrate: number,
  approxDurationMs: string
  colorInfo: {
    primaries: string
    transferCharacteristics: string
    matrixCoefficients: string
  }
}

type FetchVideo = {
  liveIn?: boolean
  status: "OK" | "ERROR"
  reason?: string
  channelId: string
  userIdYT: string
  author: string
  ownerProfileUrl: string
  videoId: string
  isLiveContent: boolean
  isUnlisted: boolean
  isPrivate: boolean
  duration: number
  title: string
  views: number
  category: LMCategory
  publishDate: string
  uploadDate: string
  shortDescription: string
  keywords: string[]
  thumbnails: {
    url: URL
    width: number
    height: number
  }[]
  formats: VideoFormats[]
  adaptiveFormats: VideoFormats[]
  audioQuality?: "AUDIO_QUALITY_LOW" | "AUDIO_QUALITY_MEDIUM" | "AUDIO_QUALITY_LOW"
  audioSampleRate: string
  audioChannels: number
  highReplication?: true,
  loudnessDb?: number
  baseScript: URL
  isLive?: true
  live?: {
    viewers: number
    isLiveNow: boolean
    startTimestamp: Date
    expiresInSeconds: string
    dashManifestUrl: URL
    hlsManifestUrl: URL
    latencyClass: string,
    isLowLatencyLiveStream: boolean
  }
}

export default async function fetchVideo(userId: string, headers?: HeadersInit): Promise<FetchVideo & FetchError | Partial<FetchVideo & FetchError>> {
  let fetchVideoData
  try {
    fetchVideoData = await fetch(`https://www.youtube.com/@${userId}/live`, { cache: "no-cache" })
  } catch (e) {
    return {
      error: 'fetch Error',
      code: 'network_error'
    }
  }

  const videoResponseRaw = await fetchVideoData.text()
  let ytInitialPlayerResponse
  const videoId = getStr(videoResponseRaw, 'https://www.youtube.com/embed/', '">')
  try {
    ytInitialPlayerResponse = JSON.parse(getStr(videoResponseRaw, `var ytInitialPlayerResponse = `, ";</script>"))
  } catch (e) {
    try {
      ytInitialPlayerResponse = JSON.parse(getStr(videoResponseRaw, `var ytInitialPlayerResponse = `, ";var head"))
    } catch {
      return {
        liveIn: false,
        status: 'ERROR',
        reason: 'Channel is Offline'
      }

    }
  }
  const ytInitialData = JSON.parse(getStr(videoResponseRaw, 'var ytInitialData = ', ';</script>'))
  const { status, reason, messages } = ytInitialPlayerResponse.playabilityStatus
  if (reason || messages) {
    return ytInitialPlayerResponse.playabilityStatus
  }

  const storyboardSpec = ytInitialPlayerResponse?.storyboards?.playerStoryboardSpecRenderer?.spec
  const duration = ytInitialPlayerResponse?.videoDetails?.lengthSeconds

  const { title, shortDescription, channelId, thumbnail: { thumbnails }, viewCount, author, lengthSeconds, isLiveContent, isLive, isPrivate, latencyClass, keywords, isLowLatencyLiveStream } = ytInitialPlayerResponse.videoDetails
  const { uploadDate, ownerProfileUrl, isUnlisted, category: categoryName, publishDate, liveBroadcastDetails, } = ytInitialPlayerResponse.microformat.playerMicroformatRenderer
  const { formats, adaptiveFormats, expiresInSeconds, dashManifestUrl, hlsManifestUrl } = ytInitialPlayerResponse.streamingData
  const category_richMetadataRenderer = findKey(ytInitialData, 'richMetadataRenderer')
  const category = {
    id: '0',
    name: categoryName,
    image: 'https://yt3.ggpht.com/QqoTjrpKRDMfGFPYpgIaTmHkbQ6Lk-brN77OxCYwl0jTtluavivXDdd4lR2wQsr_hcIggw=s136-w136-h136-c-k-c0x00ffffff-no-nd-rj'
  }
  const viewers = Number(findKey(ytInitialData, 'originalViewCount'))
  if (category_richMetadataRenderer) {
    const categoryThumbs = findKey(category_richMetadataRenderer, 'thumbnails')
    const categoryThumbnail = categoryThumbs.pop().url
    const categoryName = findKey(findKey(category_richMetadataRenderer, 'title'), 'simpleText').concat(' ') + findKey(findKey(category_richMetadataRenderer, 'subtitle'), 'simpleText')
    if (categoryName) category.name = categoryName
    if (categoryThumbnail) category.image = categoryThumbnail
  }
  const live = {
    ...liveBroadcastDetails,
    viewers,
    expiresInSeconds,
    dashManifestUrl,
    hlsManifestUrl,
    latencyClass,
    isLowLatencyLiveStream
  }
  const baseScript = `https://www.youtube.com/s/player/${getStr(videoResponseRaw, '/s/player/', '"')}`
  const userIdYT = ownerProfileUrl.split("/").pop()
  const storyBoard = extractStoryboard(storyboardSpec, duration)


  return {
    status,
    channelId,
    userIdYT,
    author,
    ownerProfileUrl,
    isLive,
    isLiveContent,
    isUnlisted,
    isPrivate,
    videoId,
    duration: Number(lengthSeconds),
    title,
    views: Number(viewCount),
    category,
    keywords,
    thumbnails,
    shortDescription,
    publishDate,
    uploadDate,
    ...(isLive && { live }),
    baseScript,
    storyBoard,
    formats,
    adaptiveFormats
  }
}