<br/>
<p align="center">
  <a href="https://github.com/zaacksb/flow-monitor">
    <img src="https://i.imgur.com/aLrth8g.png" alt="Logo" width="400" height="200">
  </a>

  <h3 align="center">Flow Monitor</h3>

  <p align="center">
    FlowMonitor is a library dedicated to simplifying the monitoring of live streams across multiple platforms. With easy integration and real-time notifications, it offers an efficient solution for tracking key events, allowing you to maintain clear control over the status of your live streams.
    <br/>
    <br/>
    <a href="https://github.com/zaacksb/flow-monitor/blob/main/README.md"><strong>Explore the docs »</strong></a>
    <br/>
    <br/>
    <a href="https://github.com/zaacksb/flow-monitor/issues">Report Bug</a>
    ·
    <a href="https://github.com/zaacksb/flow-monitor/issues">Request Feature</a>
  </p>
</p>

![Contributors](https://img.shields.io/github/contributors/zaacksb/flow-monitor?color=dark-green) ![Issues](https://img.shields.io/github/issues/zaacksb/flow-monitor) ![License](https://img.shields.io/github/license/zaacksb/flow-monitor)
[![npm version](https://img.shields.io/npm/v/flow-monitor.svg?style=flat)](https://www.npmjs.com/package/flow-monitor)

---

## Table of Contents

- [About The Project](#about-the-project)
- [Key Changes in This Version](#key-changes-in-this-version)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Detailed Usage](#detailed-usage)
- [Events](#events)
- [API Reference](#api-reference)
- [Types](#types)
- [Contribution](#contribution)
- [License](#license)

## About The Project

FlowMonitor is a comprehensive library designed for monitoring live streams on Twitch and YouTube. It provides real-time notifications for various events, including streams starting and stopping, changes in view counts, titles, and categories. Its main goal is to provide a simple and efficient way to integrate stream monitoring into your projects.

## Key Changes in This Version

This version represents a significant refactoring of the library, with a focus on improving the API and event structure.

### What's New

*   **New `Logger` class**: For more detailed and configurable logging.
*   **New `Queue` system**: Manages asynchronous operations to prevent race conditions.
*   **New `twitchPlaylist` method**: To fetch the m3u8 playlist for a Twitch stream directly.
*   **Category History**: The `category` property on the `vod` object is now an array, storing the history of categories for a stream.
*   **More Granular Events**: Events now provide more detailed and structured data. For example, the `streamUp` event now passes a `vod` object with rich information about the stream.
*   **Improved Error Handling**: The library now has more specific error events, making it easier to handle issues with Twitch and YouTube connections.
*   **New `thumbnail` event**: A new event to notify when a stream's thumbnail changes.
*   **Direct Fetch Methods**: New `fetchTwitch` and `fetchYoutube` methods to get data on demand.

### What's Changed

*   **API Simplification**: The `start()` method has been removed. The library now automatically starts monitoring when you connect to a channel.
*   **Event Renaming and Structure**:
    *   `newChannel` is now `connected`.
    *   `disconnectChannel` is now `disconnected`.
    *   `twitchError` is now `error`.
    *   Events like `streamUp`, `streamDown`, `viewCount`, `title`, and `category` now have a consistent signature, passing the `channel` and `vod` objects.
*   **Dependencies**: `axios` and `async-lock` have been removed in favor of native `fetch` and a new `Queue` implementation. `eventemitter3` is now used for event management.

### What's Removed

*   **`start()` method**: No longer needed.
*   **`livedata()` method**: You can now get the channel data directly from the `channels` property.
*   **YouTube Storyboard**: The functionality to extract storyboards from YouTube videos has been removed.

## Installation

To install FlowMonitor, use npm:

```bash
npm install flow-monitor
```

## Quick Start

Here's a quick example to get you started with FlowMonitor:

```typescript
import { FlowMonitor, Logger, LogLevel } from 'flow-monitor';

const fm = new FlowMonitor({
    log: new Logger(LogLevel.Info),
    youtube: {
        intervalChecker: 10000,
        headers: { 'User-Agent': 'FlowMonitor' }
    },
    twitch: {
        headers: { 
            'Client-ID': 'your-twitch-client-id', 
            'Authorization': 'Bearer your-twitch-token' 
        }
    }
});

fm.on('streamUp', (channel, vod) => {
    console.log(`Stream started on channel ${channel.username}`);
});

fm.connect('channel_name', 'twitch');
fm.connect('channel_name', 'youtube');
```

## Detailed Usage

### Initialization

To begin, instantiate the `FlowMonitor` class with your desired options, as shown in the [Quick Start](#quick-start) section. This single instance will be used to manage all your channel monitoring.

### Connecting to a Channel

To start monitoring a specific channel:

```typescript
fm.connect('channel_name', 'twitch');
fm.connect('channel_name', 'youtube');
```

### Disconnecting from a Channel

To stop monitoring a specific channel:

```typescript
fm.disconnect('channel_name', 'twitch');
fm.disconnect('channel_name', 'youtube');
```

### Closing Connections

To close all connections and clear all data:

```typescript
fm.close();
```

## Events

FlowMonitor emits several events that you can listen to and respond accordingly:

- `streamUp`: Emitted when a stream starts.
- `streamDown`: Emitted when a stream ends.
- `viewCount`: Emitted when the view count changes.
- `category`: Emitted when the stream's category changes.
- `title`: Emitted when the stream's title changes.
- `thumbnail`: Emitted when the stream's thumbnail changes.
- `twitchSocketOpen`: Emitted when the WebSocket connection to Twitch is opened.
- `twitchSocketClose`: Emitted when the WebSocket connection to Twitch is closed.
- `connected`: Emitted when a channel is connected.
- `disconnected`: Emitted when a channel is disconnected.
- `close`: Emitted when a connection is closed.
- `closeTwitch`: Emitted when the connection to Twitch is closed.
- `error`: Emitted when an error occurs.

### Example of Using Events

```typescript
fm.on('streamUp', (channel, vod) => {
    console.log(`Stream started on channel ${channel.username}`);
});

fm.on('streamDown', (channel, vod) => {
    console.log(`Stream ended on channel ${channel.username}`);
});

fm.on('viewCount', (channel, vod, count) => {
    console.log(`Channel ${channel.username} now has ${count} viewers`);
});

fm.on('title', (channel, vod, newTitle) => {
    console.log(`Channel ${channel.username} changed the title to ${newTitle}`);
});
```

## API Reference

### Constructor

```typescript
constructor(opts: ClientOptions = {})
```

- `opts`: Options object to configure FlowMonitor.
  - `log`: Logger instance.
  - `youtube`: Settings for YouTube monitoring.
  - `twitch`: Settings for Twitch monitoring.

### Methods

- `connect(channel: string, platform: FMPlatforms)`: Connects to a channel for monitoring.
- `disconnect(channel: string, platform: FMPlatforms)`: Disconnects from a channel.
- `close()`: Closes all connections.
- `closeTwitch(reason?: string)`: Closes the connection to Twitch.
- `fetchTwitch(channel: string)`: Fetches data for a Twitch channel.
- `fetchYoutube(videoId: string, channel?: string)`: Fetches data for a YouTube video.
- `twitchPlaylist(channel: string)`: Fetches the m3u8 playlist for a Twitch stream.

## Types

### ClientOptions

```typescript
interface ClientOptions {
    log?: Logger;
    youtube?: {
        intervalChecker?: number;
        headers?: HeadersInit;
    };
    twitch?: {
        headers?: HeadersInit;
    };
}
```

### FlowMonitorEvents

```typescript
type FlowMonitorEvents = {
    streamUp: [channel: Omit<Channel, 'streams'>, vod: Stream];
    streamDown: [channel: Omit<Channel, 'streams'>, vod: Stream];
    viewCount: [channel: Omit<Channel, 'streams'>, vod: Stream, count: number];
    category: [channel: Omit<Channel, 'streams'>, vod: Stream, newcategory: FMCategory];
    title: [channel: Omit<Channel, 'streams'>, vod: Stream, newTitle: string];
    thumbnail: [channel: Omit<Channel, 'streams'>, vod: Stream, thumbnail: string];
    twitchSocketOpen: [uri: string];
    twitchSocketClose: [code: number, reason?: string];
    connected: [channel: Channel];
    disconnected: [channel: Channel];
    close: [code: number, reason: string, wasClean: boolean];
    closeTwitch: [reason: string];
    error: [event: string];
};
```

### Stream

```typescript
type Stream = Omit<FMLiveData, 'event'>;
```

### Streams

```typescript
type Streams = Map<string, Stream>;
```

### Channel

```typescript
type Channel = {
    monitoring?: boolean;
    platform: FMPlatforms;
    username: string;
    userId: string;
    streams: Streams;
};
```

### Channels

```typescript
type Channels = Map<FMPlatforms, Map<string, Partial<Channel>>>;
```

## Contribution

To contribute to this project, please follow the guidelines described in the CONTRIBUTING.md file.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.

---

## Authors

- **ZackSB** - _Master's degree in life_ - [ZackSB](https://github.com/zaacksb/) - _Built flow-monitor_

## Acknowledgements

- [zacksb](https://github.com/zaacksb)

<h3 align="left">Support:</h3>
<p><a href="https://www.buymeacoffee.com/zacksb"> <img align="left" src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" height="50" width="210" alt="buy me a coffe" /></a></p>
<p><a href="https://livepix.gg/zvods"> <img align="left" src="https://pbs.twimg.com/profile_images/1499159563081244672/tWvzZWKI_400x400.png" height="50" width="50" alt="Donate with livepix" /></a></p><br><br>
