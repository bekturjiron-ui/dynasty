import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fmtNum } from '../lib/format'
import { Icon, Sparks, useCountUp } from './ui'

/** Последнее показанное значение живёт в sessionStorage: шапка пересоздаётся при возврате из урока, а прирост должен быть виден. */
function readSeen(key: string): number | null {
  try { const s = sessionStorage.getItem(`dynasty-res-${key}`); return s === null ? null : Number(s) } catch { return null }
}
function writeSeen(key: string, v: number) {
  try { sessionStorage.setItem(`dynasty-res-${key}`, String(v)) } catch { /* приватный режим */ }
}

function Chip({ icon, color, value, label, burst }: { icon: 'coin' | 'star' | 'crown'; color: string; value: number; label: string; burst?: number }) {
  const [seen] = useState(() => readSeen(icon))
  const start = seen !== null && seen < value ? seen : value
  const v = useCountUp(value, 900, start)
  // Прирост: над значением всплывает «+N», иконка подпрыгивает
  const prev = useRef(start)
  const [gain, setGain] = useState<{ id: number; n: number } | null>(null)
  useEffect(() => {
    const d = value - prev.current
    prev.current = value
    writeSeen(icon, value)
    if (d > 0) setGain((g) => ({ id: (g?.id ?? 0) + 1, n: d }))
  }, [value, icon])
  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-2" title={label}>
      <span key={gain?.id ?? 0} className={`${color} ${gain ? 'res-bump' : ''}`}><Icon name={icon} size={22} /></span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[15px] font-semibold tabular-nums text-parch">{fmtNum(v)}</div>
        <div className="truncate text-[10.5px] text-muted">{label}</div>
      </div>
      {gain && <span key={`f${gain.id}`} className={`res-float ${color}`}>+{fmtNum(gain.n)}</span>}
      {burst !== undefined && <Sparks burst={burst} />}
    </div>
  )
}

/** Шапка ресурсов: Капитал, Опыт, Репутация. Видна на всех вкладках. */
export function ResourceBar({ capital, xp, reputation, right }: { capital: number; xp: number; reputation: number; right?: ReactNode }) {
  return (
    <div className="pt-safe sticky top-0 z-20 -mx-4 mb-2 border-b border-white/5 bg-ink/80 px-4 pb-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2 sm:gap-3">
        <Chip icon="coin" color="text-gold" value={capital} label="₸ Капитала" burst={capital} />
        <Chip icon="star" color="text-xp" value={xp} label="Опыт" burst={xp} />
        <Chip icon="crown" color="text-rep" value={reputation} label="Репутация" />
        {right}
      </div>
    </div>
  )
}
