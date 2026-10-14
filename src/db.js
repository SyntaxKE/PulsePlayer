// Offline library: songs are stored on the device in IndexedDB.
export function openDB() {
  return new Promise((res) => {
    try {
      const r = indexedDB.open('pulse', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('t', { keyPath: 'id' })
      r.onsuccess = () => res(r.result)
      r.onerror = () => res(null)
    } catch { res(null) }
  })
}
export function getAll(db) {
  return new Promise((res) => {
    if (!db) return res([])
    try {
      const r = db.transaction('t').objectStore('t').getAll()
      r.onsuccess = () => res(r.result || [])
      r.onerror = () => res([])
    } catch { res([]) }
  })
}
export function put(db, t) { try { db && db.transaction('t', 'readwrite').objectStore('t').put(t) } catch {} }
export function del(db, id) { try { db && db.transaction('t', 'readwrite').objectStore('t').delete(id) } catch {} }
