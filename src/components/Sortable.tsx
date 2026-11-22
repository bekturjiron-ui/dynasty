import { useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'

export type HandleProps = {
  onPointerDown: (e: RPointerEvent) => void
  style: React.CSSProperties
  'aria-label': string
}

type Props<T> = {
  items: T[]
  keyOf: (t: T) => string | number
  onChange: (items: T[]) => void
  render: (item: T, i: number, h: { handle: HandleProps; dragging: boolean; up?: () => void; down?: () => void }) => ReactNode
  className?: string
}

/** Список с перетаскиванием за ручку. Pointer-события — работает пальцем на iPhone и мышью.
 *  Кнопки ↑↓ (up/down) — запасной путь и доступность. */
export function Sortable<T>({ items, keyOf, onChange, render, className = '' }: Props<T>) {
  const [order, setOrder] = useState<T[] | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const list = order ?? items

  const move = (arr: T[], from: number, to: number) => { const a = [...arr]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a }

  function start(i: number, e: RPointerEvent) {
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setOrder(items)
    setDrag(i)
    let cur = i
    let arr = items
    const onMove = (ev: PointerEvent) => {
      const y = ev.clientY
      // куда встать: ищем элемент, середину которого пересекли
      let to = cur
      refs.current.forEach((el, j) => {
        if (!el || j === cur) return
        const r = el.getBoundingClientRect()
        const mid = r.top + r.height / 2
        if (j < cur && y < mid) to = Math.min(to, j)
        if (j > cur && y > mid) to = Math.max(to, j)
      })
      if (to !== cur) { arr = move(arr, cur, to); cur = to; setOrder(arr); setDrag(to) }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setDrag(null)
      setOrder(null)
      if (cur !== i) onChange(arr)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <div className={className}>
      {list.map((it, i) => (
        <div key={keyOf(it)} ref={(el) => { refs.current[i] = el }} className={`drag-item ${drag === i ? 'is-dragging relative z-10' : ''}`}>
          {render(it, i, {
            dragging: drag === i,
            handle: { onPointerDown: (e) => start(i, e), style: { touchAction: 'none', cursor: 'grab' }, 'aria-label': 'Перетащить' },
            up: i > 0 ? () => onChange(move(items, i, i - 1)) : undefined,
            down: i < list.length - 1 ? () => onChange(move(items, i, i + 1)) : undefined,
          })}
        </div>
      ))}
    </div>
  )
}

/** Иконка ручки «⋮⋮». */
export function Grip() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="text-muted">
      {[4, 9, 14].map((y) => [6, 12].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" fill="currentColor" />))}
    </svg>
  )
}
