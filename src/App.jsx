import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { openDB, getAll, put, del } from './db.js'
import { readTags } from './id3.js'
import { searchOnline, trending, downloadOffline } from './online.js'
import { searchYT, ytAudio, isNative } from './youtube.js'
import { artBg, artUrl, coverFor } from './art.js'
import { Row, Item, Card, Sheet, MiniPlayer, FullPlayer, QueueView, DetailHead } from './components.jsx'

const shuffleArr = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const groupBy = (list, f) => { const m = new Map(); list.forEach((t) => { const k = f(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t) }); return m }
const albumOf = (t) => t.album || 'Singles'
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d } catch { return d } }
const ids = (l) => l.map((t) => t.id)
const LIKED_ART = { id: 'g:liked', title: 'Liked' }

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
  const [full, setFull] = useState(false)
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
    if (queue[qi] === id) { a.pause(); a.removeAttribute('src'); setQueue([]); setQi(0); setFull(false); setQOpen(false) }
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

  const empty = (m) => <div className="empty">{m}</div>
  const rowOf = (t, list, i, plId) => (
    <Row key={t.id + ':' + i} t={t} active={cur?.id === t.id} liked={!!liked[t.id]}
      dim={t.type === 'url' && !online}
      onPlay={() => startPlay(ids(list), i)} onMenu={() => trackMenu(t, plId)} />
  )
  const open = (kind, key) => setDetail({ kind, key })
  const playAll = (list) => { setShuf(false); startPlay(ids(list), 0, false) }
  const shufAll = (list) => { setShuf(true); startPlay(ids(list), Math.floor(Math.random() * list.length), true) }
  const goTab = (k) => { setTab(k); setDetail(null) }
  const plCard = (p) => { const l = p.ids.map((i) => byId.get(i)).filter(Boolean); return { art: artBg(coverFor(l, p.name)), sub: l.length + ' songs' } }

  return (
    <div id="app">
      <main>
        {dd ? (
          <section className="view">
            <DetailHead title={dd.title} sub={dd.sub} cover={dd.cover} onBack={() => setDetail(null)}
              onPlay={() => playAll(dd.list)} onShuffle={() => dd.list.length && shufAll(dd.list)} />
            {dd.list.length ? dd.list.map((t, i) => rowOf(t, dd.list, i, dd.pl?.id)) : empty('No songs here yet. Use ⋯ on any song to add it.')}
            {dd.pl && <button className="pill del" onClick={() => { if (confirm('Delete this playlist?')) { del(db.current, dd.pl.id, 'p'); setPlaylists((x) => x.filter((p) => p.id !== dd.pl.id)); setDetail(null) } }}>Delete playlist</button>}
          </section>
        ) : tab === 'home' ? (
          <section className="view">
            <h1>{greet}</h1>
            {tracks.length ? (<>
              <div className="acts">
                <button className="pill p" onClick={() => playAll(tracks)}>▶ Play all</button>
                <button className="pill" onClick={() => shufAll(tracks)}>⇄ Shuffle</button>
              </div>
              {recent.length > 0 && (<><h3>Recently Played</h3><div className="hs">
                {recent.map((t) => <Card key={t.id} art={artBg(t)} title={t.title} sub={t.artist} onClick={() => startPlay(ids(recent), recent.indexOf(t))} />)}</div></>)}
              <h3>Your Playlists</h3>
              <div className="hs">
                <Card art="linear-gradient(135deg,#fa2d48,#6a1fd0)" title="Liked Songs" sub={likedList.length + ' songs'} onClick={() => open('liked')} />
                {playlists.map((p) => { const c = plCard(p); return <Card key={p.id} art={c.art} title={p.name} sub={c.sub} onClick={() => open('playlist', p.id)} /> })}
              </div>
              <h3>Albums</h3>
              <div className="hs">{albums.map(([n, l]) => <Card key={n} art={artBg(coverFor(l, n))} title={n} sub={l[0].artist} onClick={() => open('album', n)} />)}</div>
              <h3>Recently Added</h3>
              <div className="hs">{[...tracks].reverse().slice(0, 10).map((t, i, arr) => <Card key={t.id} art={artBg(t)} title={t.title} sub={t.artist} onClick={() => startPlay(ids(arr), i)} />)}</div>
            </>) : null}
            {!tracks.length && !(online && trend.length) && empty('Tap ＋ below to add your songs.')}
            {online && trend.length > 0 && (<><h3>Trending Online</h3><div className="hs">
              {trend.map((t, i) => <Card key={t.id} art={artBg(t)} title={t.title} sub={t.artist} onClick={() => startPlay(ids(trend), i)} />)}</div></>)}
          </section>
        ) : tab === 'search' ? (
          <section className="view">
            <h1>Search</h1>
            <input type="search" placeholder={mode === 'library' ? 'Songs, albums, artists' : 'Search songs and artists'} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="chips">
              {[['yt', 'YouTube'], ['online', 'Audius'], ['library', 'Library']].map(([k, l]) => (
                <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>))}
            </div>
            {mode === 'yt' ? (<>
              {!isNative ? empty('YouTube works only in the installed Android app.')
                : !online ? empty('You are offline. Your songs still play from Library.')
                : ql.length > 1 ? (results.length ? results.map((t, i) => rowOf(t, results, i)) : empty(searching ? 'Searching…' : err ? 'YouTube request failed: ' + err : 'No results.'))
                : empty('Search YouTube Music for any song or artist.')}
              <div className="stat">Experimental. Unofficial YouTube access, can stop working.</div>
            </>) : mode === 'online' ? (<>
              {!online ? empty('You are offline. Your downloaded songs still play from Library.')
                : ql.length > 1 ? (results.length ? results.map((t, i) => rowOf(t, results, i)) : empty(searching ? 'Searching…' : 'No results.'))
                : (<><h3>Trending</h3>{trend.length ? trend.map((t, i) => rowOf(t, trend, i)) : empty('Loading…')}</>)}
              <div className="stat">Music from Audius. Artists keep all rights.</div>
            </>) : (ql ? (() => {
              const s2 = tracks.filter((t) => (t.title + ' ' + t.artist + ' ' + albumOf(t)).toLowerCase().includes(ql))
              const al = albums.filter(([n]) => n.toLowerCase().includes(ql))
              const ar = artists.filter(([n]) => n.toLowerCase().includes(ql))
              return (<>
                {ar.length > 0 && <><h3>Artists</h3>{ar.map(([n, l]) => <Item key={n} round art={artBg(coverFor(l, n))} title={n} sub={l.length + ' songs'} onClick={() => open('artist', n)} />)}</>}
                {al.length > 0 && <><h3>Albums</h3>{al.map(([n, l]) => <Item key={n} art={artBg(coverFor(l, n))} title={n} sub={l[0].artist} onClick={() => open('album', n)} />)}</>}
                {s2.length > 0 && <><h3>Songs</h3>{s2.map((t, i) => rowOf(t, s2, i))}</>}
                {!s2.length && !al.length && !ar.length && empty('No results.')}
              </>)
            })() : empty(tracks.length ? 'Search your library.' : 'Your library is empty.'))}
          </section>
        ) : (
          <section className="view">
            <div className="lh"><h1>Library</h1></div>
            <div className="chips">
              {[['playlists', 'Playlists'], ['albums', 'Albums'], ['artists', 'Artists'], ['songs', 'Songs']].map(([k, l]) => (
                <button key={k} className={libTab === k ? 'on' : ''} onClick={() => setLibTab(k)}>{l}</button>))}
            </div>
            {libTab === 'playlists' && (<>
              <Item art="linear-gradient(135deg,#fa2d48,#6a1fd0)" title="Liked Songs" sub={likedList.length + ' songs'} onClick={() => open('liked')} />
              {playlists.map((p) => { const c = plCard(p); return <Item key={p.id} art={c.art} title={p.name} sub={c.sub} onClick={() => open('playlist', p.id)} /> })}
              <button className="pill ghost" onClick={() => newPlaylist()}>＋ New playlist</button>
            </>)}
            {libTab === 'albums' && (albums.length
              ? <div className="grid">{albums.map(([n, l]) => <Card key={n} art={artBg(coverFor(l, n))} title={n} sub={l[0].artist} onClick={() => open('album', n)} />)}</div>
              : empty('No albums yet.'))}
            {libTab === 'artists' && (artists.length
              ? artists.map(([n, l]) => <Item key={n} round art={artBg(coverFor(l, n))} title={n} sub={l.length + ' songs'} onClick={() => open('artist', n)} />)
              : empty('No artists yet.'))}
            {libTab === 'songs' && (() => {
              const s = [...tracks].sort((x, y) => x.title.localeCompare(y.title))
              return s.length ? s.map((t, i) => rowOf(t, s, i)) : empty('No songs yet. Tap ＋ below to add some.')
            })()}
            <div className="stat">{online ? 'Online' : 'Offline'} · {tracks.length} songs on this device</div>
          </section>
        )}
      </main>

      <input ref={fileIn} type="file" accept="audio/*" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = '' }} />

      <MiniPlayer t={cur} playing={playing} progress={time.d ? time.c / time.d : 0}
        onOpen={() => setFull(true)} onToggle={toggle} onNext={() => next(false)} />

      <nav>
        {[['home', '◉', 'Home'], ['search', '⌕', 'Search'], ['lib', '≡', 'Library']].map(([k, ic, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => goTab(k)}><span>{ic}</span>{l}</button>
        ))}
        <button className="addb" onClick={addMenu}><span>＋</span>Add</button>
      </nav>

      <FullPlayer t={cur} open={full} playing={playing} time={time} shuf={shuf} rep={rep} vol={vol}
        liked={cur ? !!liked[cur.id] : false} onLike={() => cur && toggleLike(cur.id)} onQueue={() => setQOpen(true)}
        onClose={() => setFull(false)} onToggle={toggle} onNext={() => next(false)} onPrev={prev}
        onShuf={toggleShuf} onRep={() => setRep((rep + 1) % 3)}
        onSeek={(r) => { if (isFinite(a.duration)) a.currentTime = r * a.duration }}
        onVol={(v) => { setVol(v); a.volume = v / 100 }} />

      {qOpen && <QueueView cur={cur} up={up} onClose={() => setQOpen(false)}
        onJump={(i) => { if (load(queue[i]) !== false) setQi(i) }}
        onRemove={(i) => setQueue(queue.filter((_, k) => k !== i))} />}

      {toast && <div className="toast">{toast}</div>}
      <Sheet s={sheet} onClose={() => setSheet(null)} />
    </div>
  )
}
