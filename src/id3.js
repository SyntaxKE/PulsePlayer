// Reads title, artist and cover art from MP3 (ID3v2) tags.
export async function readTags(file) {
  const o = {}
  try {
    const b = new DataView(await file.slice(0, 2 << 20).arrayBuffer())
    if (b.getUint8(0) !== 73 || b.getUint8(1) !== 68 || b.getUint8(2) !== 51) return o
    const v = b.getUint8(3)
    const sy = (p) => ((b.getUint8(p) & 127) << 21) | ((b.getUint8(p + 1) & 127) << 14) | ((b.getUint8(p + 2) & 127) << 7) | (b.getUint8(p + 3) & 127)
    const end = Math.min(10 + sy(6), b.byteLength)
    let p = 10
    while (p + 10 < end) {
      let id = ''
      for (let i = 0; i < 4; i++) id += String.fromCharCode(b.getUint8(p + i))
      if (!/^[A-Z0-9]{4}$/.test(id)) break
      const fs = v === 4 ? sy(p + 4) : b.getUint32(p + 4)
      const s = p + 10
      if (fs <= 1 || s + fs > b.byteLength) break
      const enc = b.getUint8(s)
      if (id === 'TIT2' || id === 'TPE1') {
        const label = enc === 1 ? 'utf-16' : enc === 2 ? 'utf-16be' : enc === 3 ? 'utf-8' : 'iso-8859-1'
        o[id] = new TextDecoder(label).decode(new Uint8Array(b.buffer, s + 1, fs - 1)).replace(/\0/g, '').trim()
      }
      if (id === 'APIC' && !o.pic) {
        let q = s + 1
        while (b.getUint8(q)) q++
        q += 2
        if (enc === 1 || enc === 2) { while (b.getUint16(q) !== 0) q += 2; q += 2 }
        else { while (b.getUint8(q)) q++; q++ }
        o.pic = new Blob([new Uint8Array(b.buffer, q, s + fs - q)])
      }
      p = s + fs
    }
  } catch {}
  return o
}
