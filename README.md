<br/>
<p align="center">
  <a href="https://github.com/zaacksb/flow-monitor">
    <img src="https://i.imgur.com/aLrth8g.png" alt="Logo" width="400" height="200">
  </a>

  <h3 align="center">Flow Monitor</h3>

  <p align="center">  
FlowMonitor is a library dedicated to simplifying monitoring live streams across multiple platforms. With easy integration and real-time notifications, FlowMonitor offers an efficient solution for monitoring key events such as start, end and title changes, allowing you to maintain clear control over the status of your live streams. Ideal for developers looking for a hassle-free and effective approach to managing streaming data.
    <br/>
    <br/>
    <a href="https://github.com/zaacksb/flow-monitor/blob/main/README.md"><strong>Explore the docs »</strong></a>
    <br/>
    <br/>
    <a href="https://github.com/zaacksb/flow-monitor/issues">Report Bug</a>
    .
    <a href="https://github.com/zaacksb/flow-monitor/issues">Request Feature</a>
  </p>
</p>

![Contributors](https://img.shields.io/github/contributors/zaacksb/flow-monitor?color=dark-green) ![Issues](https://img.shields.io/github/issues/zaacksb/flow-monitor) ![License](https://img.shields.io/github/license/zaacksb/flow-monitor)
[![npm version](https://img.shields.io/npm/v/flow-monitor.svg?style=flat)](https://www.npmjs.com/package/flow-monitor)

## About The Project

This library was created to facilitate the use of websocket, focused more specifically on reconnection, with it it is possible to send parameters that can be used for authentication, and if the connection is closed, when the connection is resumed, it will resend the data for authentication again

## Getting Started

### Installation

First install our library

```sh
npm install flow-monitor
```

## Usage

Import the library

```js
import FlowMonitor from 'flow-monitor'
```

instantiate the class

```js
const fMonitor = new FlowMonitor({
  twitch: {
    headers: {
      Authorization: 'OAuth ', // Authorization to get the m3u8 url without ads if you are registered or have turbo, but not a mandatory parameter
    }, // optional http request headers,
  },
  youtube: {
    headers: {}, // optional http request headers,
    intervalChecker: 10 * 1000, // Time in milliseconds, default is 5000 = 5s
  },
})
```

#### Connect to channels

```js
fMonitor.connect('LofiGirl', 'youtube')
fMonitor.connect('zvods', 'twitch')
```

#### Start monitoring

```js
fMonitor.start()
```

### Event Handling

Returns twitch request errors, such as authentication error when passing authorization

```js
fMonitor.on('twitchError', (error, status, message) => {
  console.log(error, status, message)
})
```

When you call the start function and start

```js
fMonitor.on('start', () => {
  console.log('Flow monitor started')
})
```

When a new channel is connected

```js
fMonitor.on('newChannel', ({ name, platform }) => {
  console.log(name, platform)
})
```

Confirmation when the channel is disconnected using the `disconnect` function

```js
fMonitor.on('disconnectChannel', ({ name, platform }) => {
  console.log('Channel disconnected', name, platform)
})
```

When the flow monitor is finished with the `close` function

```js
fMonitor.on('close', () => {
  console.log('Flow monitor has been closed')
})
```

### These upcoming events all return an object with the current stream information

livedata structure:

```ts
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
```

When the broadcast opens, if you connect the channel and it is already live, you will receive the same

```js
fMonitor.on('streamUp', (livedata) => {
  console.log('streamUp', livedata)
})
```

When the transmission is finished

```js
fMonitor.on('streamDown', (livedata) => {
  console.log('streamDown', livedata)
})
```

When the category is changed

```js
fMonitor.on('category', (livedata) => {
  console.log('category', livedata)
})
```

Broadcast title changed

```js
fMonitor.on('title', (livedata) => {
  console.log('title', livedata)
})
```

Viewer count changes

```js
fMonitor.on('viewerCount', (livedata) => {
  console.log('viewerCount', livedata)
})
```

### Additional Functions

- `disconnect`
  Disconnects a channel from the flow monitor

  ```js
  fMonitor.disconnect('@LofiGirl', 'youtube')
  ```

- `close`
  Removes all channels and stops monitoring

  ```js
  fMonitor.close()
  ```

- `livedata`
  Returns transmission data if already saved

  ```js
  fMonitor.livedata('LofiGirl', 'youtube')
  ```

## License

Distributed under the MIT License. See [LICENSE](https://github.com/zaacksb/flow-monitor/blob/main/LICENSE) for more information.

## Authors

- **ZackSB** - _Master's degree in life_ - [ZackSB](https://github.com/zaacksb/) - _Built flow-monitor_

## Acknowledgements

- [zacksb](https://github.com/zaacksb)

<h3 align="left">Support:</h3>
<p><a href="https://www.buymeacoffee.com/zacksb"> <img align="left" src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" height="50" width="210" alt="buy me a coffe" /></a></p>
<p><a href="https://livepix.gg/zvods"> <img align="left" src="https://pbs.twimg.com/profile_images/1499159563081244672/tWvzZWKI_400x400.png" height="50" width="50" alt="Donate with livepix" /></a></p><br><br>
