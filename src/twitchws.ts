export const pubsubWSURL = "wss://pubsub-edge.twitch.tv/v1"
export type TwitchPayload = 'UNLISTEN' | 'LISTEN'


export function createNonce(length: number = 30): string {
  const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const charactersLength = characters.length;
  let nonce = '';

  for (let i = 0; i < length; i++) {
    const charIndex = Math.floor(Math.random() * charactersLength);
    nonce += characters.charAt(charIndex);
  }

  return nonce;
}

export const payloads = {
  "gameBroadcaster": (channelID: string, type: TwitchPayload = 'LISTEN') => {
    return `{"type":"${type}","nonce":"${createNonce()}","data":{"topics":["broadcast-settings-update.${channelID}"]}}`
  },
  "raid": (channelID: string, type: TwitchPayload = 'LISTEN') => {
    return `{"type":"${type}","nonce":"${createNonce()}","data":{"topics":["raid.${channelID}"]}}`
  },
  "predictions": (channelID: string, type: TwitchPayload = 'LISTEN') => {
    return `{"type":"${type}","nonce":"${createNonce()}","data":{"topics":["predictions-channel-v1.${channelID}"]}}`
  },
  "videoPlayBack": (channelID: string, type: TwitchPayload = 'LISTEN') => {
    return `{"type":"${type}","nonce":"${createNonce()}","data":{"topics":["video-playback-by-id.${channelID}"]}}`
  }
}


