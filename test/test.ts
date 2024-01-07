
import { FlowMonitor } from '../src';

const fMonitor = new FlowMonitor({
  twitch: {
    headers: {
      Authorization: 'OAuth ', // Authorization to get the m3u8 url without ads if you are registered or have turbo, but not a mandatory parameter 
    } // optional http request headers,
  },
  youtube: {
    headers: {}, // optional http request headers,
    intervalChecker: 10 * 1000 // Time in milliseconds, default is 5000 = 5s
  }
})
fMonitor.start()

fMonitor.on('twitchError', (error, status, message) => {
  console.log(error, status, message)
})

fMonitor.on('start', () => {
  console.log('bgl iniciou mané')
})

fMonitor.on('newChannel', ({ name, platform }) => {
  console.log(name, platform)
})
fMonitor.on('streamUp', (livedata) => {
  console.log('streamUp', livedata)
})
fMonitor.on('category', (livedata) => {
  console.log('category', livedata)
})
fMonitor.on('streamDown', (livedata) => {
  console.log('streamDown', livedata)
})
fMonitor.on('title', (livedata) => {
  console.log('title', livedata)
})
fMonitor.on('viewerCount', (livedata) => {
  console.log('viewerCount', livedata)
})

fMonitor.on('disconnectChannel', ({ name, platform }) => {
  console.log('channel disconnected', name, platform)
})
fMonitor.on('close', () => {
  console.log('bgl foi fechado')
})
fMonitor.connect('@LofiGirl', 'youtube')
fMonitor.connect('pedrosemfreio', 'twitch')

fMonitor.start()
// console.log(fMonitor.livedata('@LofiGirl', 'youtube'))

// setTimeout(() => {
//   const res = fMonitor.livedata('LofiGirl', 'youtube')
//   console.log(res)
//   fMonitor.disconnect('LofiGirl', 'youtube')
//   fMonitor.disconnect('pedrosemfreio', 'twitch')
// }, 30000)