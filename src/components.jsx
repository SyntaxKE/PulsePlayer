import { artBg, fmt } from './art.js'

const P = {
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  next: 'M6 6l8.5 6L6 18zM16 6h2v12h-2z',
  prev: 'M18 6l-8.5 6L18 18zM8 6H6v12h2z',
}
export const Icon = ({ n }) => (<svg viewBox="0 0 24 24"><path d={P[n]} /></svg>)

export function Row({ t, active, dim, onPlay, onDel }) {
  return (
    <div className={'row' + (active ? ' cur' : '') + (dim ? ' dim' : '')} onClick={onPlay}>
      <div className="a" style={{ background: artBg(t) }} />
      <div className="txt"><b>{t.title}</b><small>{t.artist}</small></div>
      <div><i>{t.type === 'url' ? 'Stream' : 'Offline'}</i>
        <button onClick={(e) => { e.stopPropagation(); onDel() }} aria-label="Remove">✕</button></div>
    </div>
  )
}

export function Card({ t, onPlay }) {
  return (
    <div className="card" onClick={onPlay}>
      <div className="a" style={{ background: artBg(t) }} />
      <b>{t.title}</b><small>{t.artist}</small>
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

export function FullPlayer({ t, open, playing, time, shuf, rep, vol, onClose, onToggle, onNext, onPrev, onShuf, onRep, onSeek, onVol }) {
  const bg = t ? artBg(t) : '#222'
  const ratio = isFinite(time.d) && time.d ? time.c / time.d : 0
  return (
    <div className={'full' + (open ? ' open' : '') + (playing ? ' playing' : '')}>
      <div className="fbg" style={{ background: bg }} />
      <button className="close" onClick={onClose} aria-label="Close" />
      <div className="fart" style={{ background: bg }}>{t && !t.pic ? (t.title.trim()[0] || '♪').toUpperCase() : ''}</div>
      <div className="meta"><h2>{t ? t.title : 'Nothing playing'}</h2><p>{t ? t.artist : '—'}</p></div>
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
    </div>
  )
}
