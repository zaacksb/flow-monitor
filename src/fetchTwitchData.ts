import { FetchError } from './types';
import { findKey } from './utils';


interface UserDataAccesToken {
  adblock: boolean;
  authorization: {
    forbidden: boolean;
    reason: string;
  };
  blackout_enabled: boolean;
  channel: string;
  channel_id: number;
  chansub: {
    restricted_bitrates: number[];
    view_until: number;
  };
  ci_gb: boolean;
  geoblock_reason: string;
  device_id: string;
  expires: number;
  extended_history_allowed: boolean;
  game: string;
  hide_ads: boolean;
  https_required: boolean;
  mature: boolean;
  partner: boolean;
  platform: string;
  player_type: string;
  private: {
    allowed_to_view: boolean;
  };
  privileged: boolean;
  role: string;
  server_ads: boolean;
  show_ads: boolean;
  subscriber: boolean;
  turbo: boolean;
  user_id: number;
  user_ip: string;
  version: number;
}

type FetchTwitchData = {
  userId: number
  login: string
  categoryId: number
  categoryName: string
  categoryImage: string
  thumbnail: string
  streamId: number
  started_at: string
  title: string
  viewersCount: number
  m3u8Url: string
  error?: string
  status?: number
  message?: string
}
export const fetchTwitchData = async (channel: string, headers?: HeadersInit): Promise<FetchTwitchData & FetchError | Partial<FetchTwitchData & FetchError>> => {

  const postBody = [
    {
      "operationName": "PlaybackAccessToken",
      "variables": {
        "isLive": true,
        "login": channel,
        "isVod": false,
        "vodID": "",
        "playerType": "site"
      },
      "extensions": {
        "persistedQuery": {
          "version": 1,
          "sha256Hash": "3093517e37e4f4cb48906155bcd894150aef92617939236d2508f3375ab732ce"
        }
      }
    },
    {
      "operationName": "PlayerTrackingContextQuery",
      "variables": {
        "channel": channel,
        "isLive": true,
        "hasCollection": false,
        "collectionID": "",
        "videoID": "",
        "hasVideo": false,
        "slug": "",
        "hasClip": false
      },
      "extensions": {
        "persistedQuery": {
          "version": 1,
          "sha256Hash": "f8cf144bd3a96f628b0955799b689ddaf0d9f3f1155941ae6483083e421e3027"
        }
      }
    },
    {
      "operationName": "NielsenContentMetadata",
      "variables": {
        "isCollectionContent": false,
        "isLiveContent": true,
        "isVODContent": false,
        "collectionID": "",
        "login": channel,
        "vodID": ""
      },
      "extensions": {
        "persistedQuery": {
          "version": 1,
          "sha256Hash": "2dbf505ee929438369e68e72319d1106bb3c142e295332fac157c90638968586"
        }
      }
    },
    {
      "operationName": "ChannelSkins",
      "variables": {
        "channelLogin": channel
      },
      "extensions": {
        "persistedQuery": {
          "version": 1,
          "sha256Hash": "c63e57934d378579ccb239cd5c2bd319c0c9aa03215a68db3a5163cadcb6b15f"
        }
      }
    },
    {
      "operationName": "UseViewCount",
      "variables": {
        "channelLogin": channel
      },
      "extensions": {
        "persistedQuery": {
          "version": 1,
          "sha256Hash": "00b11c9c428f79ae228f30080a06ffd8226a1f068d6f52fbc057cbde66e994c2"
        }
      }
    },

  ]
  let fetchTwitchData
  try {
    fetchTwitchData = await fetch(`https://gql.twitch.tv/gql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'client-id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        ...headers
      },
      body: JSON.stringify(postBody)
    })
  } catch (e) {
    return {
      error: 'fetch Error',
      code: 'network_error'
    }
  }


  const twitchData = await fetchTwitchData.json()
  const streamPlaybackAccessTokenValue = twitchData[0]?.data?.streamPlaybackAccessToken?.value;
  const signature = twitchData[0]?.data?.streamPlaybackAccessToken?.signature;
  const query = new URLSearchParams({
    acmb: "e30=",
    allow_source: "true",
    fast_bread: "true",
    p: "5118690",
    play_session_id: "3ef41eabf86f99c7ea5f91edb7d800f2",
    player_backend: "mediaplayer",
    playlist_include_framerate: "true",
    reassignments_supported: "true",
    sig: signature,
    supported_codecs: "avc1",
    token: streamPlaybackAccessTokenValue,
    transcode_mode: "cbr_v1",
    cdm: "wv",
    player_version: "1.22.0",
  });
  const m3u8Link = new URL(`https://usher.ttvnw.net/api/channel/hls/${channel}.m3u8`);
  const m3u8Url = `${m3u8Link}?${query.toString()}`

  const user = findKey(twitchData, 'user')
  const userId = Number(findKey(user, 'id'))
  const login = findKey(user, 'login')
  const category = findKey(twitchData, 'game')
  const categoryId = Number(findKey(category, 'id'))
  const categoryName = findKey(category, 'name')
  const categoryImage = `https://static-cdn.jtvnw.net/ttv-boxart/${categoryId}-144x192.jpg`
  const streamInfo = findKey(twitchData, 'stream')
  const streamId = Number(findKey(streamInfo, 'id'))
  const started_at = findKey(twitchData, 'createdAt')
  const title = findKey(twitchData, 'title')
  const viewersCount = Number(findKey(twitchData, 'viewersCount'))
  return {
    userId,
    login,
    categoryId,
    categoryName,
    categoryImage,
    thumbnail: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channel}-440x248.jpg`,
    streamId,
    started_at,
    title,
    viewersCount,
    m3u8Url,
    ...(twitchData?.error && twitchData)

  }
}