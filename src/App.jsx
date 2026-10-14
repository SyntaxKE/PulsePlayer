import { useCallback, useEffect, useRef, useState } from 'react'
import { openDB, getAll, put, del } from './db.js'
import { readTags } from './id3.js'
import { artUrl } from './art.js'
import { Row, Card, MiniPlayer, FullPlayer } from './components.jsx'

export default function App() {
  const audio = useRef(null)
  if (!audio.current) { audio.current = new Audio(); audio.current.volume = 0.8 }
  const a = audio.current
  const db = useRef(null)
  const objUrl = useRef(null)
  const fileIn = useRef(null)

  const [tracks, setTracks] = useState([])
  const [cur, setCur] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [shuf, setShuf] = useState(false)
  const [rep, setRep] = useState(0)
  const [vol, setVol] = useState(80)
  const [time, setTime] = useState({ c: 0, d: 0 })
  const [tab, setTab] = useState('home')
  const [full, setFull] = useState(false)
  const [q, setQ] = useState('')
  const [url, setUrl] = useState('')
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => { (async () => { db.current = await openDB(); setTracks(await getAll(db.current)) })() }, [])
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    addEventListener('online', on); addEventListener('offline', off)
    return () => { removeEventListener('online', on); removeEventListener('offline', off) }
  }, [])

  const play = useCallback((i) => {
    const t = tracks[i]; if (!t) return
    if (t.type === 'url' && !navigator.onLine) { alert('Streams need a connection.'); return }
    if (objUrl.current) { URL.revokeObjectURL(objUrl.current); objUrl.current = null }
    a.src = t.blob ? (objUrl.current = URL.createObjectURL(t.blob)) : t.url
    a.play().catch(() => {})
    setCur(i)
    if ('mediaSession' in navigator) {
      try {
        const src = artUrl(t)
        navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, artwork: src ? [{ src }] : [] })
      } catch {}
    }
  }, [tracks, a])

  const next = useCallback((auto) => {
    if (!tracks.length) return
    if (auto && rep === 2) { a.currentTime = 0; a.play(); return }
    let n = shuf ? Math.floor(Math.random() * tracks.length) : cur + 1
    if (n >= tracks.length) { if (rep === 1 || !auto) n = 0; else { a.pause(); return } }
    play(n)
  }, [tracks, cur, shuf, rep, play, a])

  const prev = useCallback(() => {
    if (a.currentTime > 3) { a.currentTime = 0; return }
    if (tracks.length) play((cur - 1 + tracks.length) % tracks.length)
  }, [tracks, cur, play, a])

  const toggle = useCallback(() => {
    if (cur < 0) { if (tracks.length) play(0); return }
    a.paused ? a.play() : a.pause()
  }, [cur, tracks, play, a])

  useEffect(() => {
    const f = {
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      timeupdate: () => setTime({ c: a.currentTime, d: a.duration }),
      ended: () => next(true),
    }
    Object.entries(f).forEach(([k, v]) => a.addEventListener(k, v))
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('previoustrack', prev)
        navigator.mediaSession.setActionHandler('nexttrack', () => next(false))
        navigator.mediaSession.setActionHandler('play', () => a.play())
        navigator.mediaSession.setActionHandler('pause', () => a.pause())
      } catch {}
    }
    return () => Object.entries(f).forEach(([k, v]) => a.removeEventListener(k, v))
  }, [next, prev, a])

  async function addFiles(files) {
    const added = []
    for (const f of files) {
      const m = await readTags(f)
      const base = f.name.replace(/\.[^.]+$/, '')
      const p = base.split(' - ')
      const t = {
        id: Date.now() + Math.random(), type: 'file',
        title: m.TIT2 || (p.length > 1 ? p.slice(1).join(' - ') : base),
        artist: m.TPE1 || (p.length > 1 ? p[0] : 'Unknown artist'),
        blob: f, pic: m.pic || null,
      }
      put(db.current, t); added.push(t)
    }
    setTracks((x) => [...x, ...added])
  }
  function addUrl() {
    const u = url.trim(); if (!/^https?:\/\//.test(u)) return
    const n = decodeURIComponent(u.split('/').pop().split('?')[0]).replace(/\.[^.]+$/, '') || 'Stream'
    const t = { id: Date.now() + Math.random(), type: 'url', title: n, artist: 'Online stream', url: u }
    put(db.current, t); setTracks((x) => [...x, t]); setUrl('')
  }
  function remove(i) {
    del(db.current, tracks[i].id)
    if (i === cur) { a.pause(); a.removeAttribute('src'); setCur(-1); setFull(false) }
    else if (i < cur) setCur(cur - 1)
    setTracks((x) => x.filter((_, k) => k !== i))
  }

  const idx = tracks.map((_, i) => i)
  const ql = q.trim().toLowerCase()
  const found = idx.filter((i) => !ql || (tracks[i].title + tracks[i].artist).toLowerCase().includes(ql))
  const t = tracks[cur]
  const rowOf = (i) => (
    <Row key={tracks[i].id} t={tracks[i]} active={i === cur}
      dim={tracks[i].type === 'url' && !online}
      onPlay={() => play(i)} onDel={() => remove(i)} />
  )
  const empty = (msg) => <div className="empty">{msg}</div>

  return (
    <div id="app">
      <main>
        {tab === 'home' && (
          <section className="view">
            <h1>Listen Now</h1>
            <div className="acts">
              <button className="pill p" onClick={() => { setShuf(false); tracks.length && play(0) }}>▶ Play</button>
              <button className="pill" onClick={() => { setShuf(true); tracks.length && play(Math.floor(Math.random() * tracks.length)) }}>⇄ Shuffle</button>
            </div>
            <h3>Recently Added</h3>
            <div className="hs">
              {tracks.length
                ? idx.slice(-10).reverse().map((i) => <Card key={tracks[i].id} t={tracks[i]} onPlay={() => play(i)} />)
                : empty('Your recent songs appear here.')}
            </div>
            <h3>Songs</h3>
            {tracks.length ? idx.map(rowOf) : empty('Nothing here yet. Open Library to add songs.')}
          </section>
        )}
        {tab === 'search' && (
          <section className="view">
            <h1>Search</h1>
            <input type="search" placeholder="Your library" value={q} onChange={(e) => setQ(e.target.value)} />
            {found.length ? found.map(rowOf) : empty(tracks.length ? 'No results.' : 'Your library is empty.')}
          </section>
        )}
        {tab === 'lib' && (
          <section className="view">
            <h1>Library</h1>
            <div className="set">Songs you add are stored on this device and play offline.
              <button className="pill p" onClick={() => fileIn.current.click()}>+ Add songs from device</button>
              <input ref={fileIn} type="file" accept="audio/*" multiple hidden
                onChange={(e) => { addFiles([...e.target.files]); e.target.value = '' }} /></div>
            <div className="set">Stream from a direct audio link (online)<br /><br />
              <input type="url" placeholder="https://…/song.mp3" value={url} onChange={(e) => setUrl(e.target.value)} />
              <button className="pill" onClick={addUrl}>+ Add stream</button></div>
            <div className="set">Status: <b>{online ? 'Online' : 'Offline'}</b> · {tracks.length} tracks</div>
          </section>
        )}
      </main>

      <MiniPlayer t={t} playing={playing} progress={time.d ? time.c / time.d : 0}
        onOpen={() => setFull(true)} onToggle={toggle} onNext={() => next(false)} />

      <nav>
        {[['home', '◉', 'Home'], ['search', '⌕', 'Search'], ['lib', '≡', 'Library']].map(([k, ic, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><span>{ic}</span>{l}</button>
        ))}
      </nav>

      <FullPlayer t={t} open={full} playing={playing} time={time} shuf={shuf} rep={rep} vol={vol}
        onClose={() => setFull(false)} onToggle={toggle} onNext={() => next(false)} onPrev={prev}
        onShuf={() => setShuf(!shuf)} onRep={() => setRep((rep + 1) % 3)}
        onSeek={(r) => { if (isFinite(a.duration)) a.currentTime = r * a.duration }}
        onVol={(v) => { setVol(v); a.volume = v / 100 }} />
    </div>
  )
}
