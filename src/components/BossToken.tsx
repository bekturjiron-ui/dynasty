import { useEffect, useState } from 'react'
import { Icon } from './ui'

const BASE = import.meta.env.BASE_URL

export type BossState = 'locked' | 'ready' | 'done'

/** Силуэт в капюшоне: показывается, пока нет картинки босса (public/art/bosses/<id>.webp). */
function Silhouette({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 100 125" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="pm-robe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d5420" />
          <stop offset="1" stopColor="#241a0a" />
        </linearGradient>
      </defs>
      <path
        d="M50 8c-11 0-19 8-19 19 0 6 2 11 6 15L22 118h56L63 42c4-4 6-9 6-15 0-11-8-19-19-19z"
        fill={lit ? 'url(#pm-robe)' : '#0a0a0d'}
        stroke={lit ? '#e8cd72' : 'rgba(201,162,39,0.28)'}
        strokeWidth="1.4"
      />
      {lit && <><circle cx="43" cy="30" r="2.2" fill="#ffe9a8" /><circle cx="57" cy="30" r="2.2" fill="#ffe9a8" /></>}
    </svg>
  )
}

/**
 * Босс недели на пункте карты. Тёмная копия лежит снизу всегда, цветная проявляется поверх волной снизу вверх.
 * woke — босс только что стал доступным: проявление идёт на глазах, а не готовым.
 */
export function BossToken({ art, state, woke, title }: { art: string | null; state: BossState; woke: boolean; title: string }) {
  const [imgOk, setImgOk] = useState<boolean | null>(null)
  const [revealed, setRevealed] = useState(!woke)

  useEffect(() => {
    if (!art) { setImgOk(false); return }
    let alive = true
    const im = new Image()
    im.onload = () => alive && setImgOk(true)
    im.onerror = () => alive && setImgOk(false)
    im.src = `${BASE}art/bosses/${art}.webp`
    return () => { alive = false }
  }, [art])

  useEffect(() => {
    if (!woke) return
    const t = setTimeout(() => setRevealed(true), 350)
    return () => clearTimeout(t)
  }, [woke])

  const lit = state !== 'locked' && revealed
  const src = `${BASE}art/bosses/${art}.webp`
  const figure = (isLit: boolean) => (imgOk ? <img src={src} alt="" draggable={false} className="h-full w-full object-contain" /> : <Silhouette lit={isLit} />)

  return (
    <div className="pm-boss" data-state={state} role="img" aria-label={`Босс: ${title}`}>
      <div className="pm-boss-dark">{figure(false)}</div>
      <div className={`pm-boss-lit${lit ? ' on' : ''}${woke ? ' woke' : ''}`}>{figure(true)}</div>
      {woke && revealed && <span className="pm-wake-ring" aria-hidden />}
      {state === 'done' && <span className="pm-boss-check" aria-hidden><Icon name="check" size={14} /></span>}
    </div>
  )
}
