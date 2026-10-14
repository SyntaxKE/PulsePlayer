// Online catalog: Audius (free, open music network). Artists keep their rights; we always show artist names.
const API = 'https://api.audius.co/v1'
const APP = 'Pulse'

const toTrack = (x) => ({
  id: 'a:' + x.id,
  type: 'url',
  online: true,
  title: x.title,
  artist: (x.user && x.user.name) || 'Unknown artist',
  album: 'Audius',
  url: `${API}/tracks/${x.id}/stream?app_name=${APP}`,
  artUrl: (x.artwork && (x.artwork['480x480'] || x.artwork['150x150'])) || null,
  downloadable: !!x.downloadable,
})

async function get(path, params = {}) {
  const u = new URL(API + path)
  Object.entries({ app_name: APP, ...params }).forEach(([k, v]) => u.searchParams.set(k, v))
  const r = await fetch(u)
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const j = await r.json()
  return j.data || []
}

export const searchOnline = (q) => get('/tracks/search', { query: q, limit: 25 }).then((d) => d.map(toTrack))
export const trending = () => get('/tracks/trending', { limit: 20 }).then((d) => d.map(toTrack))

// Saves the song itself on the phone (only offered when the artist allows downloads).
export async function downloadOffline(t) {
  const r = await fetch(t.url)
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const blob = await r.blob()
  let pic = null
  if (t.artUrl) { try { pic = await (await fetch(t.artUrl)).blob() } catch {} }
  return { id: t.id, type: 'file', online: false, title: t.title, artist: t.artist, album: '', blob, pic }
}
