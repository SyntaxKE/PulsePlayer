// EXPERIMENTAL: unofficial YouTube Music access (search + audio). Personal use only.
// It breaks the YouTube terms of service and can stop working at any time.
// Works only in the installed Android app (native HTTP is used to avoid browser CORS limits).
// If streams get blocked, the client versions below are the first thing to update.
import { Capacitor, CapacitorHttp } from '@capacitor/core'

export const isNative = Capacitor.isNativePlatform()

const WEB_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
const MUSIC_CTX = { client: { clientName: 'WEB_REMIX', clientVersion: '1.20250310.01.00', hl: 'en', gl: 'US' } }
const SONGS_FILTER = 'EgWKAQIIAWoMEA4QChADEAQQCRAF'

// Player clients tried in order until one gives playable audio.
const CLIENTS = [
  { num: 5, ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    ctx: { clientName: 'IOS', clientVersion: '20.10.4', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82', hl: 'en', gl: 'US' } },
  { num: 28, ua: 'com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    ctx: { clientName: 'ANDROID_VR', clientVersion: '1.62.27', deviceMake: 'Oculus', deviceModel: 'Quest 3', osName: 'Android', osVersion: '12L', androidSdkVersion: 32, hl: 'en', gl: 'US' } },
  { num: 101, ua: 'com.google.ios.youtube/0.1 (RealityDevice14,1; U; CPU iOS 17_0 like Mac OS X;)',
    ctx: { clientName: 'VISIONOS', clientVersion: '0.1', deviceMake: 'Apple', deviceModel: 'RealityDevice14,1', osName: 'visionOS', osVersion: '1.3.21O771', hl: 'en', gl: 'US' } },
]

async function post(url, body, headers) {
  const r = await CapacitorHttp.post({
    url, data: body, readTimeout: 30000, connectTimeout: 15000,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
  if (r.status < 200 || r.status >= 300) throw new Error('HTTP ' + r.status)
  return typeof r.data === 'string' ? JSON.parse(r.data) : r.data
}

function findKey(o, key) {
  if (!o || typeof o !== 'object') return null
  if (typeof o[key] === 'string') return o[key]
  for (const v of Object.values(o)) { const r = findKey(v, key); if (r) return r }
  return null
}
function collect(node, fn) {
  if (Array.isArray(node)) node.forEach((n) => collect(n, fn))
  else if (node && typeof node === 'object') {
    if (node.musicResponsiveListItemRenderer) fn(node.musicResponsiveListItemRenderer)
    else Object.values(node).forEach((v) => collect(v, fn))
  }
}

export function parseSearch(json) {
  const out = [], seen = new Set()
  collect(json, (r) => {
    const vid = findKey(r, 'videoId')
    if (!vid || seen.has(vid)) return
    const runs = (i) => ((r.flexColumns || [])[i]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []).map((x) => x.text)
    const title = runs(0).join('').trim()
    if (!title) return
    const meta = runs(1).map((x) => x.trim()).filter((x) => x && x !== '•' && !/^\d+:\d{2}(:\d{2})?$/.test(x) && !/^(Song|Video)$/i.test(x))
    const th = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || []
    const art = th.length ? th[th.length - 1].url.replace(/=w\d+-h\d+/, '=w512-h512') : null
    seen.add(vid)
    out.push({ id: 'y:' + vid, type: 'url', online: true, yt: true, vid, title, artist: meta[0] || 'Unknown artist', album: 'YouTube', artUrl: art, downloadable: false })
  })
  return out
}

export async function searchYT(q) {
  const j = await post('https://music.youtube.com/youtubei/v1/search?prettyPrint=false',
    { context: MUSIC_CTX, query: q, params: SONGS_FILTER },
    { Origin: 'https://music.youtube.com', Referer: 'https://music.youtube.com/', 'User-Agent': WEB_UA })
  return parseSearch(j)
}

async function getFormat(vid, c) {
  const j = await post('https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false', {
    context: { client: c.ctx }, videoId: vid, contentCheckOk: true, racyCheckOk: true,
    playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } },
  }, { 'User-Agent': c.ua, 'X-YouTube-Client-Name': String(c.num), 'X-YouTube-Client-Version': c.ctx.clientVersion, Origin: 'https://www.youtube.com' })
  const st = j.playabilityStatus && j.playabilityStatus.status
  if (st && st !== 'OK') throw new Error(st)
  const au = ((j.streamingData && j.streamingData.adaptiveFormats) || []).filter((f) => /^audio\//.test(f.mimeType) && f.url)
  if (!au.length) throw new Error('no audio url')
  const score = (f) => (/mp4/.test(f.mimeType) ? 1e8 : 0) + (f.bitrate || 0)
  au.sort((x, y) => score(y) - score(x))
  const f = au[0]
  return { url: f.url, mime: f.mimeType.split(';')[0], len: Number(f.contentLength) || 0, ua: c.ua }
}

// Downloads the audio in 2 MB pieces with native HTTP (right user-agent), returns a playable Blob.
async function fetchAudio(f) {
  const CH = 2 * 1024 * 1024
  const parts = []
  let pos = 0
  for (;;) {
    const end = f.len ? Math.min(pos + CH - 1, f.len - 1) : pos + CH - 1
    const r = await CapacitorHttp.get({
      url: f.url + '&range=' + pos + '-' + end, responseType: 'blob', readTimeout: 30000, connectTimeout: 15000,
      headers: { 'User-Agent': f.ua, Origin: 'https://www.youtube.com' },
    })
    if (r.status < 200 || r.status >= 300) throw new Error('HTTP ' + r.status)
    const bin = atob(r.data), u8 = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
    parts.push(u8); pos += u8.length
    if (!u8.length || (f.len ? pos >= f.len : u8.length < CH)) break
  }
  return new Blob(parts, { type: f.mime })
}

const cache = new Map() // keeps the last few songs so replays are instant
export async function ytAudio(vid) {
  if (!isNative) throw new Error('works only in the installed app')
  if (cache.has(vid)) return cache.get(vid)
  let last = 'unknown'
  for (const c of CLIENTS) {
    try {
      const blob = await fetchAudio(await getFormat(vid, c))
      cache.set(vid, blob)
      if (cache.size > 4) cache.delete(cache.keys().next().value)
      return blob
    } catch (e) { last = e.message || String(e) }
  }
  throw new Error(last)
}
