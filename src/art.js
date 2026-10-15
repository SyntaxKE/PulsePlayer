const urls = new Map()
const hue = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h }
export function artBg(t) {
  if (t.bg) return t.bg
  if (t.artUrl) return `url(${t.artUrl})`
  if (t.pic) {
    if (!urls.has(t.id)) urls.set(t.id, URL.createObjectURL(t.pic))
    return `url(${urls.get(t.id)})`
  }
  const h = hue(t.title)
  return `linear-gradient(135deg,hsl(${h} 75% 58%),hsl(${(h + 55) % 360} 70% 30%))`
}
export const artUrl = (t) => t.artUrl || (t.pic ? urls.get(t.id) : undefined)
export const fmt = (s) => (isFinite(s) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00')
// Cover for a group of songs (album, artist, playlist): first real cover art, else a colour from the name.
export function coverFor(items, name) {
  return items.find((t) => t.pic) || { id: 'g:' + name, title: name || '?' }
}
