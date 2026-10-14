import { artBg, fmt } from './art.js'

const P = {
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  next: 'M6 6l8.5 6L6 18zM16 6h2v12h-2z',
  prev: 'M18 6l-8.5 6L18 18zM8 6H6v12h2z',
  queue: 'M3 6h13v2H3zM3 11h13v2H3zM3 16h8v2H3zM18 10l4 3-4 3z',
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
}
export const Icon = ({ n, on }) => (
  <svg viewBox="0 0 24 24" className={n === 'heart' ? 'heart' + (on ? ' on' : '') : ''}><path d={P[n]} /></svg>
)

// A song row with a ⋯ menu
export function Row({ t, active, dim, liked, onPlay, onMenu }) {
  return (
    <div className={'row' + (active ? ' cur' : '') + (dim ? ' dim' : '')} onClick={onPlay}>
      <div className="a" style={{ background: artBg(t) }} />
      <div className="txt"><b>{t.title}</b><small>{t.artist}</small></div>
      <div className="rt">
        {liked && <span className="lk">♥</span>}
        {t.type === 'url' && <i>Stream</i>}
        <button onClick={(e) => { e.stopPropagation(); onMenu() }} aria-label="More">⋯</button>
      </div>
    </div>
  )
}

// A generic list item (playlist, artist, album)
export function Item({ art, title, sub, round, onClick }) {
  return (
    <div className="row" onClick={onClick}>
      <div className={'a' + (round ? ' rd' : '')} style={{ background: art }} />
      <div className="txt"><b>{title}</b><small>{sub}</small></div>
      <div className="rt"><span className="chev">›</span></div>
    </div>
  )
}

// A square card (carousels and grids)
export function Card({ art, title, sub, round, onClick }) {
  return (
    <div className="card" onClick={onClick}>
      <div className={'a' + (round ? ' rd' : '')} style={{ background: art }} />
      <b>{title}</b><small>{sub}</small>
    </div>
  )
}

export function Sheet({ s, onClose }) {
  if (!s) return null
  return (
    <div className="sh" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {s.title && <div className="sh-h"><b>{s.title}</b><small>{s.sub}</small></div>}
        {s.items.map((x, i) => (
          <button key={i} className={x.danger ? 'danger' : ''} onClick={() => { onClose(); x.onClick() }}>{x.label}</button>
        ))}
        <button className="cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

export function MiniPlayer({ t, playing, progress, onOpen, onToggle, onNext }) {
  if (!t) return null
  return (
    <div className="mini" onClick={onOpen}>
      <div className="a" style={{ background: artBg(t) }} />
      <div className="txt"><b>{t.title}</b><small>{t.artist}</small></div>
      <button onClick={(e) => { e.stopPropagation(); onToggle() }}><Icon n={playing ? 'pause' : 'play'} /></button>
      <button onClick={(e) => { e.stopPropagation(); onNext() }}><Icon n="next" /></button>
      <div className="mbar" style={{ width: progress * 100 + '%' }} />
    </div>
  )
}

export function FullPlayer({ t, open, playing, time, shuf, rep, vol, liked, onLike, onQueue, onClose, onToggle, onNext, onPrev, onShuf, onRep, onSeek, onVol }) {
  const bg = t ? artBg(t) : '#222'
  const ratio = isFinite(time.d) && time.d ? time.c / time.d : 0
  return (
    <div className={'full' + (open ? ' open' : '') + (playing ? ' playing' : '')}>
      <div className="fbg" style={{ background: bg }} />
      <button className="close" onClick={onClose} aria-label="Close" />
      <div className="fart" style={{ background: bg }}>{t && !t.pic && !t.artUrl ? (t.title.trim()[0] || '♪').toUpperCase() : ''}</div>
      <div className="meta">
        <div className="mt"><h2>{t ? t.title : 'Nothing playing'}</h2><p>{t ? t.artist : '—'}</p></div>
        {t && <button className="hb" onClick={onLike} aria-label="Like"><Icon n="heart" on={liked} /></button>}
      </div>
      <div className="seek">
        <input type="range" min="0" max="1000" value={Math.round(ratio * 1000)} onChange={(e) => onSeek(e.target.value / 1000)} />
        <div className="tm"><span>{fmt(time.c)}</span><span>{fmt(time.d)}</span></div>
      </div>
      <div className="ctl">
        <button className={shuf ? 'on' : ''} onClick={onShuf}>⇄</button>
        <button onClick={onPrev}><Icon n="prev" /></button>
        <button className="big" onClick={onToggle}><Icon n={playing ? 'pause' : 'play'} /></button>
        <button onClick={onNext}><Icon n="next" /></button>
        <button className={rep ? 'on' : ''} onClick={onRep}>{rep === 2 ? '↺¹' : '↻'}</button>
      </div>
      <div className="vol">🔈<input type="range" min="0" max="100" value={vol} onChange={(e) => onVol(e.target.value)} />🔊</div>
      <button className="qbtn" onClick={onQueue} aria-label="Up next"><Icon n="queue" /></button>
    </div>
  )
}

export function QueueView({ cur, up, onJump, onRemove, onClose }) {
  return (
    <div className="qv">
      <div className="qh"><b>Up Next</b><button onClick={onClose}>Done</button></div>
      <div className="qb">
        {cur && (<><small className="ql">Now playing</small>
          <Item art={artBg(cur)} title={cur.title} sub={cur.artist} onClick={() => {}} /></>)}
        <small className="ql">Next up</small>
        {up.length ? up.map(({ t, i }) => (
          <div className="row" key={t.id + ':' + i} onClick={() => onJump(i)}>
            <div className="a" style={{ background: artBg(t) }} />
            <div className="txt"><b>{t.title}</b><small>{t.artist}</small></div>
            <div className="rt"><button onClick={(e) => { e.stopPropagation(); onRemove(i) }} aria-label="Remove">✕</button></div>
          </div>
        )) : <div className="empty">Nothing queued. Use ⋯ on a song and pick Play next.</div>}
      </div>
    </div>
  )
}

export function DetailHead({ title, sub, cover, onBack, onPlay, onShuffle }) {
  return (
    <div className="dh">
      <button className="back" onClick={onBack}>‹ Back</button>
      <div className="dart" style={{ background: artBg(cover) }} />
      <h1>{title}</h1><p>{sub}</p>
      <div className="acts">
        <button className="pill p" onClick={onPlay}>▶ Play</button>
        <button className="pill" onClick={onShuffle}>⇄ Shuffle</button>
      </div>
    </div>
  )
}
