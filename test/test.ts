
import { FlowMonitor } from '../src';

const monitor = new FlowMonitor({
  twitch: {
    headers: {
      Authorization: 'OAuth ',
      'X-Device-Id': 'twitch-web-wall-mason',
      'Device-ID': 'twitch-web-wall-mason'
    }
  }
})

monitor.on('disconnected', (channel) => {
  console.log(`channel disconnected ${channel.username}/${channel.platform}`)
  // monitor.closeTwitch()
})
monitor.on('connected', (channel) => {
  console.log(`channel connected ${channel.username}/${channel.platform}`)
})


monitor.on('streamUp', (channel, vod) => {
  console.log(`Stream started on channel ${channel.username} (${channel.platform}) ${vod.vodId}`);
  console.log(vod.m3u8Url)
});

monitor.on('streamDown', (channel, vod) => {
  console.log(`Stream ended on channel ${channel.username} (${channel.platform}) ${vod.vodId}`);
});

monitor.on('viewCount', (channel, vod, count) => {
  console.log(`Channel ${channel.username} (${channel.platform}) now has ${count} viewers`);
});

monitor.on('title', (channel, vod, newTitle) => {
  console.log(`Channel ${channel.username} (${channel.platform}) changed the title to "${newTitle}"`);
});

monitor.on('category', (channel, vod, newCategory) => {
  console.log(`Channel ${channel.username} (${channel.platform}) changed the category to ${newCategory}`);
});

monitor.on('thumbnail', (channel, vod, thumbnail) => {
  console.log(`Channel ${channel.username} (${channel.platform}) updated the thumbnail to ${thumbnail}`);
});

monitor.on('twitchSocketOpen', () => {
  console.log('WebSocket connection to Twitch is opened');
});

monitor.on('connected', (channel) => {
  console.log(`Connected to ${channel.username} (${channel.platform})`);
});

monitor.on('disconnected', (channel) => {
  console.log(`Disconnected from ${channel.username} (${channel.platform})`);
});

monitor.on('close', (code, reason, wasClean) => {
  console.log(`Connection closed: ${reason} (clean: ${wasClean})`);
});

monitor.on('closeTwitch', (reason) => {
  console.log(`Twitch connection closed: ${reason}`);
});

monitor.on('error', (event) => {
  console.error(`Error: ${event}`);
});
monitor.connect('@lofigirl', 'youtube')
// monitor.connect('yayahuz', 'twitch')
// // monitor.connect('choke7', 'twitch')
// // monitor.connect('piratesoftware', 'twitch')


// setTimeout(() => {
//   console.log(monitor.channels.values())
//   monitor.disconnect('@lofigirl', 'youtube')
//   console.log(monitor.channels.values())
// }, 10_000)

