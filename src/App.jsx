import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { openDB, getAll, put, del } from './db.js'
import { readTags } from './id3.js'
import { searchOnline, trending, downloadOffline } from './online.js'
import { searchYT, ytAudio, isNative } from './youtube.js'
import { artUrl, coverFor, fmt } from './art.js'
import {
  AudioLines, Home, Search, LibraryBig, Plus, Heart, Music2, Shuffle, SkipBack, SkipForward,
  Play, Pause, Repeat2, Repeat1, MoreHorizontal, ListMusic, Volume2, X, Menu, ChevronLeft, WifiOff,
} from 'lucide-react'
import { Cover, SongRow, AlbumCard, Sheet } from './components.jsx'
import './App.css'

const shuffleArr = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const groupBy = (list, f) => { const m = new Map(); list.forEach((t) => { const k = f(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t) }); return m }
const albumOf = (t) => t.album || 'Singles'
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d } catch { return d } }
const ids = (l) => l.map((t) => t.id)
const LIKED_ART = { id: 'g:liked', title: 'Liked', bg: 'linear-gradient(135deg,#a34cff,#4b2bb5)' }

export default function App() {
  const audio = useRef(null)
  if (!audio.current) { audio.current = new Audio(); audio.current.volume = 0.8 }
  const a = audio.current
  const db = useRef(null)
  const objUrl = useRef(null)
  const fileIn = useRef(null)
  const toastT = useRef(null)
  const seqRef = useRef(0)

  const [tracks, setTracks] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [liked, setLiked] = useState(() => ls('pulse-liked', {}))
  const [played, setPlayed] = useState(() => ls('pulse-played', {}))
  const [queue, setQueue] = useState([])
  const [qi, setQi] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [shuf, setShuf] = useState(false)
  const [rep, setRep] = useState(0)
  const [vol, setVol] = useState(80)
  const [time, setTime] = useState({ c: 0, d: 0 })
  const [tab, setTab] = useState('home')
  const [libTab, setLibTab] = useState('playlists')
  const [detail, setDetail] = useState(null)
  const [drawer, setDrawer] = useState(false)
  const contentRef = useRef(null)
  const [qOpen, setQOpen] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [q, setQ] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [netTracks, setNetTracks] = useState({})
  const [trend, setTrend] = useState([])
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [mode, setMode] = useState('yt')
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    (async () => {
      db.current = await openDB()
      setTracks(await getAll(db.current, 't'))
      setPlaylists(await getAll(db.current, 'p'))
    })()
  }, [])
  useEffect(() => { try { localStorage.setItem('pulse-liked', JSON.stringify(liked)) } catch {} }, [liked])
  useEffect(() => { try { localStorage.setItem('pulse-played', JSON.stringify(played)) } catch {} }, [played])
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    addEventListener('online', on); addEventListener('offline', off)
    return () => { removeEventListener('online', on); removeEventListener('offline', off) }
  }, [])

  const byId = useMemo(() => new Map([...Object.values(netTracks), ...tracks].map((t) => [t.id, t])), [tracks, netTracks])

  // ---------- online catalog ----------
  function registerNet(list) { setNetTracks((m) => { const n = { ...m }; list.forEach((t) => (n[t.id] = t)); return n }) }
  function flash(m) { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 2600) }
  useEffect(() => {
    if (online && !trend.length) trending().then((l) => { registerNet(l); setTrend(l) }).catch(() => {})
  }, [online]) // eslint-disable-line
  useEffect(() => {
    const s = q.trim()
    if (mode === 'library' || s.length < 2 || !online) { setResults([]); setSearching(false); return }
    let live = true
    setSearching(true); setErr('')
    const fn = mode === 'yt' ? searchYT : searchOnline
    const h = setTimeout(() => {
      fn(s).then((l) => { if (live) { registerNet(l); setResults(l) } })
        .catch((e) => { if (live) { setResults([]); setErr(e.message || 'failed') } })
        .finally(() => live && setSearching(false))
    }, 450)
    return () => { live = false; clearTimeout(h) }
  }, [q, mode, online])
  const cur = byId.get(queue[qi])

  // ---------- playback ----------
  const load = useCallback((id) => {
    const t = byId.get(id); if (!t) return false
    if (t.type === 'url' && !navigator.onLine) { alert('Streams need a connection.'); return false }
    if (objUrl.current) { URL.revokeObjectURL(objUrl.current); objUrl.current = null }
    const seq = ++seqRef.current
    if (t.yt) {
      a.pause(); setToast('Loading…')
      ytAudio(t.vid).then((blob) => {
        if (seq !== seqRef.current) return
        objUrl.current = URL.createObjectURL(blob); a.src = objUrl.current; a.play().catch(() => {}); setToast('')
      }).catch((e) => { if (seq === seqRef.current) flash('YouTube blocked this song: ' + e.message) })
    } else {
      a.src = t.blob ? (objUrl.current = URL.createObjectURL(t.blob)) : t.url
      a.play().catch(() => {})
    }
    setPlayed((p) => ({ ...p, [id]: Date.now() }))
    if ('mediaSession' in navigator) {
      try {
        const src = artUrl(t)
        navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: albumOf(t), artwork: src ? [{ src }] : [] })
      } catch {}
    }
    return true
  }, [byId, a])

  const startPlay = useCallback((list, start = 0, sh = shuf) => {
    if (!list.length) return
    let l = [...list], s = start
    if (sh) { const first = l[start]; l = [first, ...shuffleArr(l.filter((_, i) => i !== start))]; s = 0 }
    if (load(l[s]) === false) return
    setQueue(l); setQi(s)
  }, [shuf, load])

  const next = useCallback((auto) => {
    if (!queue.length) return
    if (auto && rep === 2) { a.currentTime = 0; a.play(); return }
    let n = qi + 1
    if (n >= queue.length) { if (rep === 1 || !auto) n = 0; else { a.pause(); return } }
    if (load(queue[n]) !== false) setQi(n)
  }, [queue, qi, rep, load, a])

  const prev = useCallback(() => {
    if (a.currentTime > 3) { a.currentTime = 0; return }
    const n = Math.max(0, qi - 1)
    if (queue.length && load(queue[n]) !== false) setQi(n)
  }, [queue, qi, load, a])

  const toggle = useCallback(() => {
    if (!cur) { if (tracks.length) startPlay(ids(tracks), 0); return }
    a.paused ? a.play() : a.pause()
  }, [cur, tracks, startPlay, a])

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

  function toggleShuf() {
    const nv = !shuf; setShuf(nv)
    if (nv && queue.length) setQueue([...queue.slice(0, qi + 1), ...shuffleArr(queue.slice(qi + 1))])
  }
  function playNext(id) {
    if (!queue.length) return startPlay([id], 0, false)
    const n = [...queue]; n.splice(qi + 1, 0, id); setQueue(n)
  }
  function addQ(id) { queue.length ? setQueue([...queue, id]) : startPlay([id], 0, false) }

  // ---------- library ----------
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
        album: m.TALB || '', blob: f, pic: m.pic || null,
      }
      put(db.current, t); added.push(t)
    }
    setTracks((x) => [...x, ...added])
  }
  function addStream() {
    const u = (prompt('Paste a direct audio link (https://…)') || '').trim()
    if (!/^https?:\/\//.test(u)) return
    const n = decodeURIComponent(u.split('/').pop().split('?')[0]).replace(/\.[^.]+$/, '') || 'Stream'
    const t = { id: Date.now() + Math.random(), type: 'url', title: n, artist: 'Online stream', album: 'Streams', url: u }
    put(db.current, t); setTracks((x) => [...x, t])
  }
  function savePl(pl) {
    put(db.current, pl, 'p')
    setPlaylists((x) => (x.some((p) => p.id === pl.id) ? x.map((p) => (p.id === pl.id ? pl : p)) : [...x, pl]))
  }
  function newPlaylist(tid) {
    const name = (prompt('Playlist name') || '').trim(); if (!name) return
    savePl({ id: 'pl' + Date.now(), name, ids: tid ? [tid] : [] })
  }
  function saveOnline(t) {
    if (tracks.some((x) => x.id === t.id)) return
    put(db.current, t); setTracks((x) => [...x, t])
  }
  function ensureSaved(id) { const t = byId.get(id); if (t && t.online) saveOnline(t) }
  async function downloadTrack(t) {
    if (!navigator.onLine) return flash('You are offline')
    flash('Downloading…')
    try {
      const f = await downloadOffline(t)
      put(db.current, f); setTracks((x) => [...x.filter((y) => y.id !== f.id), f]); flash('Saved for offline')
    } catch { flash('Download failed') }
  }
  function toggleLike(id) { ensureSaved(id); setLiked((l) => { const n = { ...l }; n[id] ? delete n[id] : (n[id] = 1); return n }) }
  function removeTrack(id) {
    del(db.current, id)
    playlists.filter((p) => p.ids.includes(id)).forEach((p) => savePl({ ...p, ids: p.ids.filter((x) => x !== id) }))
    if (queue[qi] === id) { a.pause(); a.removeAttribute('src'); setQueue([]); setQi(0); setQOpen(false) }
    else { const c = queue[qi]; const nq = queue.filter((x) => x !== id); setQueue(nq); setQi(Math.max(0, nq.indexOf(c))) }
    setTracks((x) => x.filter((t) => t.id !== id))
  }

  // ---------- menus ----------
  function pickPlaylist(tid) {
    setSheet({
      title: 'Add to playlist', sub: '',
      items: [
        { label: '＋ New playlist', onClick: () => { ensureSaved(tid); newPlaylist(tid) } },
        ...playlists.map((p) => ({ label: p.name, onClick: () => { ensureSaved(tid); !p.ids.includes(tid) && savePl({ ...p, ids: [...p.ids, tid] }) } })),
      ],
    })
  }
  function trackMenu(t, plId) {
    const inLib = tracks.some((x) => x.id === t.id)
    const items = [
      { label: 'Play next', onClick: () => playNext(t.id) },
      { label: 'Add to queue', onClick: () => addQ(t.id) },
      { label: liked[t.id] ? 'Remove from Liked Songs' : 'Add to Liked Songs', onClick: () => toggleLike(t.id) },
      { label: 'Add to playlist…', onClick: () => pickPlaylist(t.id) },
    ]
    if (t.online && !inLib) items.push({ label: 'Save to library', onClick: () => { saveOnline(t); flash('Saved to library') } })
    if (t.online && !t.yt) items.push(t.downloadable
      ? { label: 'Download for offline', onClick: () => downloadTrack(t) }
      : { label: 'Offline not allowed by artist', onClick: () => flash('The artist has not enabled downloads for this song') })
    if (plId) items.push({ label: 'Remove from this playlist', onClick: () => { const p = playlists.find((x) => x.id === plId); savePl({ ...p, ids: p.ids.filter((x) => x !== t.id) }) } })
    if (inLib) items.push({ label: 'Delete from library', danger: true, onClick: () => confirm('Delete this song from your library?') && removeTrack(t.id) })
    setSheet({ title: t.title, sub: t.artist, items })
  }
  function addMenu() {
    setSheet({ items: [
      { label: 'Add songs from device', onClick: () => fileIn.current.click() },
      { label: 'Add stream link', onClick: addStream },
      { label: '＋ New playlist', onClick: () => newPlaylist() },
    ] })
  }

  // ---------- derived ----------
  const likedList = tracks.filter((t) => liked[t.id])
  const albums = [...groupBy(tracks, albumOf)]
  const artists = [...groupBy(tracks, (t) => t.artist)]
  const recent = tracks.filter((t) => played[t.id]).sort((x, y) => played[y.id] - played[x.id]).slice(0, 10)
  const ql = q.trim().toLowerCase()
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  let dd = null
  if (detail) {
    const { kind, key } = detail
    if (kind === 'liked') dd = { title: 'Liked Songs', sub: likedList.length + ' songs', list: likedList, cover: LIKED_ART }
    else if (kind === 'album') { const l = tracks.filter((t) => albumOf(t) === key); dd = { title: key, sub: 'Album · ' + l.length + ' songs', list: l, cover: coverFor(l, key) } }
    else if (kind === 'artist') { const l = tracks.filter((t) => t.artist === key); dd = { title: key, sub: 'Artist · ' + l.length + ' songs', list: l, cover: coverFor(l, key) } }
    else if (kind === 'playlist') {
      const pl = playlists.find((p) => p.id === key)
      if (pl) { const l = pl.ids.map((i) => byId.get(i)).filter(Boolean); dd = { title: pl.name, sub: 'Playlist · ' + l.length + ' songs', list: l, cover: coverFor(l, pl.name), pl } }
    }
  }
  const up = queue.map((id, i) => ({ t: byId.get(id), i })).filter((x) => x.i > qi && x.t)

  const empty = (m) => <div className="empty-state">{m}</div>
  const PH = { id: 'g:none', title: 'Pulse' }
  const dur = isFinite(time.d) && time.d > 0 ? time.d : 0
  const prog = (v) => ({ '--progress': v + '%' })
  const rowOf = (t, list, i, plId) => (
    <SongRow key={t.id + ':' + i} t={t} active={cur?.id === t.id} liked={!!liked[t.id]}
      dim={t.type === 'url' && !online}
      onClick={() => startPlay(ids(list), i)} onMore={() => trackMenu(t, plId)} />
  )
  const open = (kind, key) => { setDetail({ kind, key }); setDrawer(false); contentRef.current?.scrollTo({ top: 0 }) }
  const nav = (k) => { setTab(k); setDetail(null); setDrawer(false); contentRef.current?.scrollTo({ top: 0 }) }
  const playAll = (list) => { setShuf(false); startPlay(ids(list), 0, false) }
  const shufAll = (list) => { setShuf(true); startPlay(ids(list), Math.floor(Math.random() * list.length), true) }
  const plArt = (p) => coverFor(p.ids.map((i) => byId.get(i)).filter(Boolean), p.name)
  const plCount = (p) => p.ids.filter((i) => byId.get(i)).length + ' songs'
  const seek = (v) => { if (isFinite(a.duration)) a.currentTime = Number(v) }
  const repIcon = rep === 2 ? <Repeat1 size={21} /> : <Repeat2 size={21} />
  const likedNow = cur ? !!liked[cur.id] : false

  const hero = (
    <section className="now-playing-section">
      <div className="ambient-glow" />
      <div className="player-art-wrap"><Cover t={cur || PH} className="player-art" /></div>
      <div className="track-heading"><h1>{cur ? cur.title : 'Nothing playing'}</h1><p>{cur ? cur.artist : 'Search or add songs to start'}</p></div>
      <div className="track-actions">
        <button className={`icon-button like-button ${likedNow ? 'liked' : ''}`} onClick={() => cur && toggleLike(cur.id)} aria-label="Like song"><Heart size={23} fill={likedNow ? 'currentColor' : 'none'} /></button>
        <button className="icon-button queue-open" onClick={() => setQOpen(true)} aria-label="Queue"><ListMusic size={23} /></button>
        <button className="icon-button" onClick={() => cur && trackMenu(cur)} aria-label="More options"><MoreHorizontal size={24} /></button>
      </div>
      <div className="seek-area">
        <input aria-label="Track progress" className="range seek-range" type="range" min="0" max={dur || 100} value={Math.min(time.c, dur || 100)} onChange={(e) => seek(e.target.value)} style={prog(dur ? (time.c / dur) * 100 : 0)} />
        <div className="time-labels"><span>{fmt(time.c)}</span><span>{fmt(dur)}</span></div>
      </div>
      <div className="player-controls">
        <button className={`icon-button secondary-control ${shuf ? 'control-on' : ''}`} onClick={toggleShuf} aria-label="Shuffle"><Shuffle size={20} /></button>
        <button className="icon-button" onClick={prev} aria-label="Previous track"><SkipBack size={25} fill="currentColor" /></button>
        <button className="play-button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={27} fill="currentColor" /> : <Play size={27} fill="currentColor" />}</button>
        <button className="icon-button" onClick={() => next(false)} aria-label="Next track"><SkipForward size={25} fill="currentColor" /></button>
        <button className={`icon-button secondary-control ${rep ? 'control-on' : ''}`} onClick={() => setRep((rep + 1) % 3)} aria-label="Repeat">{repIcon}</button>
      </div>
    </section>
  )

  const recentAdded = [...tracks].reverse().slice(0, 10)
  const homeSections = (
    <section className="recent-section">
      {recent.length > 0 && (<><div className="section-title-row"><h2>Recently played</h2></div>
        <div className="album-grid home-grid">{recent.map((t, i) => <AlbumCard key={t.id} art={t} title={t.title} sub={t.artist} onClick={() => startPlay(ids(recent), i)} />)}</div></>)}
      {recentAdded.length > 0 && (<><div className="section-title-row"><h2>Recently added</h2></div>
        <div className="album-grid home-grid">{recentAdded.map((t, i) => <AlbumCard key={t.id} art={t} title={t.title} sub={t.artist} onClick={() => startPlay(ids(recentAdded), i)} />)}</div></>)}
      {albums.length > 0 && (<><div className="section-title-row"><h2>Albums</h2></div>
        <div className="album-grid home-grid">{albums.slice(0, 10).map(([n, l]) => <AlbumCard key={n} art={coverFor(l, n)} title={n} sub={l[0].artist} onClick={() => open('album', n)} />)}</div></>)}
      {online && trend.length > 0 && (<><div className="section-title-row"><h2>Trending online</h2></div>
        <div className="album-grid home-grid">{trend.slice(0, 10).map((t, i) => <AlbumCard key={t.id} art={t} title={t.title} sub={t.artist} onClick={() => startPlay(ids(trend), i)} />)}</div></>)}
      {!tracks.length && !(online && trend.length) && empty('Tap + to add songs from your phone, or open Search to find music on YouTube.')}
    </section>
  )

  const searchView = (
    <section className="recent-section view-pad">
      <div className="section-title-row"><h2>Search</h2></div>
      <div className="chip-row">
        {[['yt', 'YouTube'], ['online', 'Audius'], ['library', 'Library']].map(([k, l]) => (
          <button key={k} className={`chip ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)}>{l}</button>))}
      </div>
      {mode === 'yt' ? (<>
        {!isNative ? empty('YouTube works only in the installed Android app.')
          : !online ? empty('You are offline. Your songs still play from Library.')
          : ql.length > 1 ? (results.length ? <div className="search-results">{results.map((t, i) => rowOf(t, results, i))}</div> : empty(searching ? 'Searching…' : err ? 'YouTube request failed: ' + err : 'No results.'))
          : empty('Type in the search box above to find any song or artist.')}
        <div className="note">Experimental. Unofficial YouTube access, can stop working.</div>
      </>) : mode === 'online' ? (<>
        {!online ? empty('You are offline. Your downloaded songs still play from Library.')
          : ql.length > 1 ? (results.length ? <div className="search-results">{results.map((t, i) => rowOf(t, results, i))}</div> : empty(searching ? 'Searching…' : 'No results.'))
          : (<><div className="sub-title">Trending</div>{trend.length ? <div className="search-results">{trend.map((t, i) => rowOf(t, trend, i))}</div> : empty('Loading…')}</>)}
        <div className="note">Music from Audius. Artists keep all rights.</div>
      </>) : (ql ? (() => {
        const s2 = tracks.filter((t) => (t.title + ' ' + t.artist + ' ' + albumOf(t)).toLowerCase().includes(ql))
        const al = albums.filter(([n]) => n.toLowerCase().includes(ql))
        const ar = artists.filter(([n]) => n.toLowerCase().includes(ql))
        return (<>
          {ar.length > 0 && <><div className="sub-title">Artists</div><div className="album-grid">{ar.map(([n, l]) => <AlbumCard key={n} round art={coverFor(l, n)} title={n} sub={l.length + ' songs'} onClick={() => open('artist', n)} />)}</div></>}
          {al.length > 0 && <><div className="sub-title">Albums</div><div className="album-grid">{al.map(([n, l]) => <AlbumCard key={n} art={coverFor(l, n)} title={n} sub={l[0].artist} onClick={() => open('album', n)} />)}</div></>}
          {s2.length > 0 && <><div className="sub-title">Songs</div><div className="search-results">{s2.map((t, i) => rowOf(t, s2, i))}</div></>}
          {!s2.length && !al.length && !ar.length && empty('No results.')}
        </>)
      })() : empty(tracks.length ? 'Type in the search box above to search your library.' : 'Your library is empty.'))}
    </section>
  )

  const libView = (
    <section className="recent-section view-pad">
      <div className="section-title-row"><h2>Your Library</h2><button className="btn-small" onClick={addMenu}><Plus size={16} /> Add music</button></div>
      <div className="chip-row">
        {[['playlists', 'Playlists'], ['albums', 'Albums'], ['artists', 'Artists'], ['songs', 'Songs']].map(([k, l]) => (
          <button key={k} className={`chip ${libTab === k ? 'on' : ''}`} onClick={() => setLibTab(k)}>{l}</button>))}
      </div>
      {libTab === 'playlists' && (
        <div className="album-grid">
          <AlbumCard art={LIKED_ART} title="Liked Songs" sub={likedList.length + ' songs'} onClick={() => open('liked')} />
          {playlists.map((p) => <AlbumCard key={p.id} art={plArt(p)} title={p.name} sub={plCount(p)} onClick={() => open('playlist', p.id)} />)}
          <button className="album-card" onClick={() => newPlaylist()}><div className="album-cover-wrap newcover"><Plus size={34} /></div><strong>New playlist</strong><span>Create</span></button>
        </div>)}
      {libTab === 'albums' && (albums.length
        ? <div className="album-grid">{albums.map(([n, l]) => <AlbumCard key={n} art={coverFor(l, n)} title={n} sub={l[0].artist} onClick={() => open('album', n)} />)}</div>
        : empty('No albums yet. Add songs with the + button.'))}
      {libTab === 'artists' && (artists.length
        ? <div className="album-grid">{artists.map(([n, l]) => <AlbumCard key={n} round art={coverFor(l, n)} title={n} sub={l.length + ' songs'} onClick={() => open('artist', n)} />)}</div>
        : empty('No artists yet.'))}
      {libTab === 'songs' && (() => {
        const s2 = [...tracks].sort((x, y) => x.title.localeCompare(y.title))
        return s2.length ? <div className="search-results">{s2.map((t, i) => rowOf(t, s2, i))}</div> : empty('No songs yet. Add some with the + button.')
      })()}
    </section>
  )

  const detailView = dd && (
    <section className="recent-section">
      <div className="detail-head">
        <button className="icon-button" onClick={() => setDetail(null)} aria-label="Back"><ChevronLeft size={24} /></button>
        <div className="detail-art"><Cover t={dd.cover} /></div>
        <div className="detail-meta">
          <span className="eyebrow">{detail.kind === 'playlist' || detail.kind === 'liked' ? 'Playlist' : detail.kind}</span>
          <h1>{dd.title}</h1><p>{dd.sub}</p>
          <div className="detail-actions">
            <button className="btn-primary" onClick={() => playAll(dd.list)}><Play size={18} fill="currentColor" /> Play</button>
            <button className="btn-ghost" onClick={() => dd.list.length && shufAll(dd.list)}><Shuffle size={18} /> Shuffle</button>
          </div>
        </div>
      </div>
      {dd.list.length ? <div className="search-results">{dd.list.map((t, i) => rowOf(t, dd.list, i, dd.pl?.id))}</div> : empty('No songs here yet. Use ⋯ on any song to add it.')}
      {dd.pl && <button className="btn-danger" onClick={() => { if (confirm('Delete this playlist?')) { del(db.current, dd.pl.id, 'p'); setPlaylists((x) => x.filter((p) => p.id !== dd.pl.id)); setDetail(null) } }}>Delete playlist</button>}
    </section>
  )

  const queueList = (
    <div className="queue-list">
      {cur && (<><div className="queue-label">Now playing</div><SongRow t={cur} active liked={likedNow} onClick={() => {}} /></>)}
      <div className="queue-label">Playing next</div>
      {up.length ? up.map(({ t, i }) => (
        <SongRow key={t.id + ':' + i} t={t}
          onClick={() => { if (load(queue[i]) !== false) setQi(i) }}
          onRemove={() => setQueue(queue.filter((_, k) => k !== i))} />
      )) : empty('Nothing queued. Use ⋯ on a song and pick Play next.')}
    </div>
  )

  const navItems = [{ k: 'home', label: 'Home', Icon: Home }, { k: 'search', label: 'Search', Icon: Search }, { k: 'lib', label: 'Your Library', Icon: LibraryBig }]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${drawer ? 'sidebar-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><AudioLines size={30} strokeWidth={2.7} /></span><span>Pulse</span>
          <button className="icon-button close-sidebar" onClick={() => setDrawer(false)} aria-label="Close menu"><X /></button></div>
        <nav className="main-nav">
          {navItems.map(({ k, label, Icon }) => (
            <button key={k} className={`nav-item ${!detail && tab === k ? 'active' : ''}`} onClick={() => nav(k)}><Icon size={21} /><span>{label}</span></button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-heading">Playlists</div>
        <button className="nav-item" onClick={() => { setDrawer(false); newPlaylist() }}><Plus size={22} /><span>Create Playlist</span></button>
        <button className={`nav-item playlist-item ${detail?.kind === 'liked' ? 'active' : ''}`} onClick={() => open('liked')}><Heart className="heart-fill" size={20} fill="currentColor" /><span>Liked Songs</span></button>
        {playlists.map((p) => (
          <button key={p.id} className={`nav-item playlist-item ${detail?.kind === 'playlist' && detail.key === p.id ? 'active' : ''}`} onClick={() => open('playlist', p.id)}><Music2 size={19} /><span>{p.name}</span></button>
        ))}
        <button className="nav-item add-music" onClick={() => { setDrawer(false); addMenu() }}><Plus size={22} /><span>Add music</span></button>
        <div className="sidebar-bottom" onClick={() => cur && nav('home')}>
          <Cover t={cur || PH} className="mini-cover" />
          <div className="mini-track"><strong>{cur ? cur.title : 'Nothing playing'}</strong><span>{cur ? cur.artist : 'Pulse'}</span></div>
          <button className="icon-button mini-play" onClick={(e) => { e.stopPropagation(); toggle() }} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={19} /> : <Play size={19} />}</button>
        </div>
      </aside>

      {drawer && <button className="mobile-scrim" onClick={() => setDrawer(false)} aria-label="Close navigation" />}

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-toggle" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu /></button>
          <label className="search-box">
            <Search size={20} />
            <input value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value) { setTab('search'); setDetail(null) } }} placeholder="Search songs, artists, albums..." />
            {q && <button className="icon-button clear-search" onClick={() => setQ('')} aria-label="Clear search"><X size={17} /></button>}
          </label>
          <div className="topbar-actions">
            {!online && <span className="offline-chip"><WifiOff size={13} /> Offline</span>}
            <button className="add-btn" onClick={addMenu} aria-label="Add music"><Plus size={22} /></button>
          </div>
        </header>
        <main className="content" ref={contentRef}>
          {dd ? detailView : tab === 'home' ? (<>{hero}{homeSections}</>) : tab === 'search' ? searchView : libView}
        </main>
      </div>

      <aside className="queue-panel">
        <div className="queue-tabs"><button className="selected">Queue</button></div>
        {queueList}
      </aside>

      <footer className="bottom-player">
        <div className="bottom-track" onClick={() => nav('home')}>
          <Cover t={cur || PH} />
          <div><strong>{cur ? cur.title : 'Nothing playing'}</strong><span>{cur ? cur.artist : 'Pulse'}</span></div>
          <button className={`icon-button bottom-like ${likedNow ? 'liked' : ''}`} onClick={(e) => { e.stopPropagation(); cur && toggleLike(cur.id) }} aria-label="Like song"><Heart size={21} fill={likedNow ? 'currentColor' : 'none'} /></button>
        </div>
        <div className="bottom-center">
          <div className="bottom-controls">
            <button className={`icon-button secondary-control ${shuf ? 'control-on' : ''}`} onClick={toggleShuf} aria-label="Shuffle"><Shuffle size={18} /></button>
            <button className="icon-button" onClick={prev} aria-label="Previous"><SkipBack size={21} fill="currentColor" /></button>
            <button className="bottom-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}</button>
            <button className="icon-button" onClick={() => next(false)} aria-label="Next"><SkipForward size={21} fill="currentColor" /></button>
            <button className={`icon-button secondary-control ${rep ? 'control-on' : ''}`} onClick={() => setRep((rep + 1) % 3)} aria-label="Repeat">{rep === 2 ? <Repeat1 size={19} /> : <Repeat2 size={19} />}</button>
          </div>
          <div className="bottom-seek"><span>{fmt(time.c)}</span>
            <input className="range" type="range" min="0" max={dur || 100} value={Math.min(time.c, dur || 100)} onChange={(e) => seek(e.target.value)} aria-label="Track progress" style={prog(dur ? (time.c / dur) * 100 : 0)} />
            <span>{fmt(dur)}</span></div>
        </div>
        <div className="bottom-tools">
          <button className="icon-button" onClick={() => setQOpen(true)} aria-label="Queue"><ListMusic size={21} /></button>
          <Volume2 size={21} />
          <input className="range volume-range" aria-label="Volume" type="range" min="0" max="100" value={vol} onChange={(e) => { setVol(Number(e.target.value)); a.volume = e.target.value / 100 }} style={prog(vol)} />
        </div>
      </footer>

      <input ref={fileIn} type="file" accept="audio/*" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = '' }} />

      {qOpen && (
        <div className="queue-overlay">
          <div className="queue-tabs"><button className="selected">Queue</button><button className="icon-button" onClick={() => setQOpen(false)} aria-label="Close queue"><X size={22} /></button></div>
          {queueList}
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
      <Sheet s={sheet} onClose={() => setSheet(null)} />
    </div>
  )
}
