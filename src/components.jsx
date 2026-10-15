import { AudioLines, Heart, MoreHorizontal, Play, X } from 'lucide-react'
import { artBg } from './art.js'

// Cover art (real artwork, remote image, or generated colour)
export const Cover = ({ t, className = '' }) => (
  <div className={`cv ${className}`} style={{ background: artBg(t) }} />
)

// A song row: tap to play, ⋯ for the menu
export function SongRow({ t, active, dim, liked, onClick, onMore, onRemove }) {
  return (
    <div className={`song-row ${active ? 'song-active' : ''} ${dim ? 'song-dim' : ''}`} onClick={onClick} role="button" tabIndex={0}>
      <div className="song-thumb-wrap">
        <Cover t={t} className="song-thumb" />
        {active && <span className="playing-indicator"><AudioLines size={17} /></span>}
      </div>
      <span className="song-info"><strong>{t.title}</strong><span>{t.artist}</span></span>
      {liked && <Heart size={14} className="row-heart" fill="currentColor" />}
      {t.type === 'url' && <span className="tag">{t.yt ? 'YouTube' : t.online ? 'Audius' : 'Stream'}</span>}
      {onMore && <button className="icon-button" onClick={(e) => { e.stopPropagation(); onMore() }} aria-label="More"><MoreHorizontal size={19} /></button>}
      {onRemove && <button className="icon-button" onClick={(e) => { e.stopPropagation(); onRemove() }} aria-label="Remove"><X size={17} /></button>}
    </div>
  )
}

// A square card (albums, playlists, artists, songs)
export function AlbumCard({ art, title, sub, round, onClick }) {
  return (
    <button className="album-card" onClick={onClick}>
      <div className={`album-cover-wrap ${round ? 'rd' : ''}`}>
        <Cover t={art} />
        <span className="album-play"><Play size={21} fill="currentColor" /></span>
      </div>
      <strong>{title}</strong><span>{sub}</span>
    </button>
  )
}

// Bottom action sheet
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
