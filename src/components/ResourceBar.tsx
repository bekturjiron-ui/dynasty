import type { ReactNode } from 'react'
import { fmtNum } from '../lib/format'
import { Icon, Sparks, useCountUp } from './ui'

function Chip({ icon, color, value, label, burst }: { icon: 'coin' | 'star' | 'crown'; color: string; value: number; label: string; burst?: number }) {
  const v = useCountUp(value)
  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-2" title={label}>
      <span className={color}><Icon name={icon} size={22} /></span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[15px] font-semibold tabular-nums text-parch">{fmtNum(v)}</div>
        <div className="truncate text-[10.5px] text-muted">{label}</div>
      </div>
      {burst !== undefined && <Sparks burst={burst} />}
    </div>
  )
}

/** Шапка ресурсов: Капитал, Опыт, Репутация. Видна на всех вкладках. */
export function ResourceBar({ capital, xp, reputation, right }: { capital: number; xp: number; reputation: number; right?: ReactNode }) {
  return (
    <div className="pt-safe sticky top-0 z-20 -mx-4 mb-2 border-b border-white/5 bg-ink/80 px-4 pb-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2 sm:gap-3">
        <Chip icon="coin" color="text-gold" value={capital} label="₸ Капитала" />
        <Chip icon="star" color="text-xp" value={xp} label="Опыт" burst={xp} />
        <Chip icon="crown" color="text-rep" value={reputation} label="Репутация" />
        {right}
      </div>
    </div>
  )
}
