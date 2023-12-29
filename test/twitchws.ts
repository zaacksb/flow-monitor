import { ClientRequestArgs } from 'http'
import WebSocket from "ws"
import { payloads, pubsubWSURL } from '../src/twitchws'
import EventEmitter from 'events'
const sleep = (time: number = 1000) => new Promise(resolve => setTimeout(resolve, time))

export type zWebsocketPersistentT = {
  url: string
  reconnect?: {
    maxRetries?: number
    connectTimeout?: number,
  }
  ping?: {
    data: any
    interval: number
  }
  options?: WebSocket.ClientOptions | ClientRequestArgs | undefined
}

export class zWebsocketPersistent extends EventEmitter {
  #connectionOpenned = false
  #sendOnConnectStrings: string[] = []
  #reconnectOpts = {
    maxRetries: 10,
    connectTimeout: 5 * 1000,

  }
  #pingOpts = {
    data: null,
    interval: 60 * 1000,
  }
  #currentRetries = 0
  #ws: WebSocket
  #url: string
  #options
  constructor({ url, ping, reconnect, options }: zWebsocketPersistentT) {
    super()
    if (ping) this.#pingOpts = { ...this.#pingOpts, ...ping }
    if (reconnect) this.#reconnectOpts = { ...this.#reconnectOpts, ...reconnect }
    this.#url = url
    this.#options = options
  }

  on<E extends keyof zWebsocketPersistentEvents>(event: E, listener: zWebsocketPersistentEvents[E]): this {
    return super.on(event, listener);
  }

  public connect() {
    this.#ws = new WebSocket(this.#url, this.#options)
    this.addWSListeners()
    return this.#ws
  }

  private addWSListeners() {
    let intervalPing: NodeJS.Timeout
    this.#ws.on('open', () => {
      this.#currentRetries = 0
      this.#connectionOpenned = true
      this.#sendOnConnectStrings.forEach(data => this.send(data))
      if (this.#pingOpts?.data) {
        intervalPing = setInterval(() => {
          if (this.#pingOpts?.data) this.send(this.#pingOpts.data)
        }, this.#pingOpts.interval)
      }
      this.emit('onOpen')
    })
    this.#ws.on('error', (err) => {
      this.emit('onError', err)
    })
    this.#ws.on('message', (buffer) => {
      this.emit('onMessage', buffer)
      this.emit('onText', buffer.toString())
    })
    this.#ws.on('close', async (code, reason) => {
      clearInterval(intervalPing)
      this.#currentRetries++
      this.emit('onClose', code, reason)
      if (code !== 111) {
        if (this.#currentRetries <= this.#reconnectOpts.maxRetries || this.#reconnectOpts.maxRetries == -1) {
          await sleep(this.#reconnectOpts.connectTimeout)
          this.emit('onRetry', this.#currentRetries, this.#reconnectOpts.maxRetries == -1 ? Infinity : this.#reconnectOpts.maxRetries)
          this.connect()
        } else {
          this.emit('onMaxRetries')
        }
      } else {
        this.#connectionOpenned = false
      }
    })
  }

  public async waitTwitchWSConnected() {
    return new Promise(resolve => {
      setInterval(() => {
        if (this.#ws?.readyState == WebSocket.OPEN) resolve(true)
      }, 10)
    })
  }


  public disconnect = (reason?: string) => { this.#ws.close(111, reason) }
  public open = () => !this.#connectionOpenned && this.connect()
  public send = async (text: string | Buffer) => {
    await this.waitTwitchWSConnected()
    this.#ws?.send?.(text)
    this.emit('onSend', text.toString())
    this.emit('onSend', text.toString())
  }
  public json = async (data: any) => {
    await this.waitTwitchWSConnected()
    this.#ws?.send?.(JSON.stringify(data))
    this.emit('onSend', JSON.stringify(data))
  }

  public sendOnConnect = (content?: string) => {
    if (content) {
      this.#sendOnConnectStrings.push(content)
      this.send(content)
    }
    return this.#sendOnConnectStrings
  }
  public removeSendOnConnect = (content: string) => {
    const index = this.#sendOnConnectStrings.indexOf(content)
    this.#sendOnConnectStrings.splice(index, 1);
    return this.#sendOnConnectStrings
  }

  public isConnected = () => this.#ws?.readyState == WebSocket.OPEN
}


export type onTextEvent = (text: string) => void
export type onMessageEvent = (message: WebSocket.RawData) => void
export type onCloseEvent = (code: number, reason: Buffer | string) => void
export type onOpenEvent = () => void
export type onMaxRetriesEvent = () => void
export type onErrorEvent = (err: Error) => void
export type onSendEvent = (data: string) => void
export type onRetryEvent = (retry: number, max: number) => void

export type zWebsocketPersistentEvents = {
  onText: onTextEvent
  onMessage: onMessageEvent
  onClose: onCloseEvent
  onOpen: onOpenEvent
  onMaxRetries: onMaxRetriesEvent
  onError: onErrorEvent
  onSend: onSendEvent
  onRetry: onRetryEvent
}


async function main() {
  const zWebsocket = new zWebsocketPersistent({
    url: pubsubWSURL,
    ping: {
      data: '{"type":"PING"}',
      interval: 3 * 60 * 1000
    },
    reconnect: {
      maxRetries: -1
    }
  })
  zWebsocket.sendOnConnect(payloads.videoPlayBack('79211298'))
  zWebsocket.open()

  zWebsocket.on('onSend', console.log)
  zWebsocket.on('onOpen', () => console.log('poubsub connected'))
  zWebsocket.on('onClose', (code, reason) => console.log('poubsub disconnected', code, reason))
  zWebsocket.on('onRetry', (retry, max) => console.log('retry', retry, max))
  zWebsocket.on('onMaxRetries', () => console.log('max retries'))
  zWebsocket.on('onText', (text) => console.log(text))

}


main()
