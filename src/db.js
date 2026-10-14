// Offline storage on the device (IndexedDB). 't' = songs, 'p' = playlists.
export function openDB() {
  return new Promise((res) => {
    try {
      const r = indexedDB.open('pulse', 2)
      r.onupgradeneeded = () => {
        const d = r.result
        if (!d.objectStoreNames.contains('t')) d.createObjectStore('t', { keyPath: 'id' })
        if (!d.objectStoreNames.contains('p')) d.createObjectStore('p', { keyPath: 'id' })
      }
      r.onsuccess = () => res(r.result)
      r.onerror = () => res(null)
    } catch { res(null) }
  })
}
export function getAll(db, s = 't') {
  return new Promise((res) => {
    if (!db) return res([])
    try {
      const r = db.transaction(s).objectStore(s).getAll()
      r.onsuccess = () => res(r.result || [])
      r.onerror = () => res([])
    } catch { res([]) }
  })
}
export function put(db, v, s = 't') { try { db && db.transaction(s, 'readwrite').objectStore(s).put(v) } catch {} }
export function del(db, id, s = 't') { try { db && db.transaction(s, 'readwrite').objectStore(s).delete(id) } catch {} }
