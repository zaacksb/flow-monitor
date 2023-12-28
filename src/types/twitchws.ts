export interface TwitchWSMessage {
  type: "PONG" | "MESSAGE" | "RESPONSE"
  error?: string
  nonce?: string
  data: {
    topic: string
    message: string
  }
}

export type StatusChangeTypes = "stream-up" | "stream-down" | "viewcount"
export interface IStatusChangeProps {
  type: StatusChangeTypes
  server_time: number
  play_delay: number
  viewers: number
  liveInfo?: {
    id?: string
    title?: string
  }
}

export interface IBroadcastChange {
  channel_id: string
  type: 'broadcast_settings_update'
  channel: string
  old_status: string
  status: string
  old_game: string
  game: string
  old_game_id: number,
  game_id: number,
}
