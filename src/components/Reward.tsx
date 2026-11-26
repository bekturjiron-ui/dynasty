import { useEffect, useState } from 'react'
import { fmtNum } from '../lib/format'
import { Icon, Sparks } from './ui'

type Kind = 'capital' | 'xp' | 'reputation'

const LOOK: Record<Kind, { icon: 'coin' | 'star' | 'crown'; color: string; ring: string; label: string; unit: string }> = {
  capital: { icon: 'coin', color: 'text-gold', ring: 'reward-gold', label: 'Капитал', unit: ' ₸' },
  xp: { icon: 'star', color: 'text-xp', ring: 'reward-xp', label: 'Опыт', unit: ' XP' },
  reputation: { icon: 'crown', color: 'text-rep', ring: 'reward-rep', label: 'Репутация', unit: '' },
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Счётчик от 0 до target после задержки; по окончании возвращает done. */
function useRollUp(target: number, delay: number, ms = 900) {
  const [v, setV] = useState(reduced() ? target : 0)
  const [done, setDone] = useState(reduced())
  useEffect(() => {
    if (reduced()) { setV(target); setDone(true); return }
    let raf = 0
    const t = setTimeout(() => {
      const start = performance.now()
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / ms)
        setV(Math.round(target * (1 - Math.pow(1 - k, 3))))
        if (k < 1) raf = requestAnimationFrame(tick)
        else setDone(true)
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => { clearTimeout(t); cancelAnimationFrame(raf) }
  }, [target, delay, ms])
  return { v, done }
}

function Pill({ kind, value, index }: { kind: Kind; value: number; index: number }) {
  const l = LOOK[kind]
  const delay = 250 + index * 220
  const { v, done } = useRollUp(Math.abs(value), delay)
  const sign = value < 0 ? '−' : '+'
  return (
    <div className={`reward-pill ${l.ring} relative flex min-w-0 max-w-[15rem] flex-1 items-center gap-2.5 rounded-2xl px-3 py-2.5`} style={{ animationDelay: `${index * 220}ms` }}>
      <span className={`reward-icon ${l.color} flex h-9 w-9 shrink-0 items-center justify-center rounded-full`} style={{ animationDelay: `${delay}ms` }}>
        <Icon name={l.icon} size={22} />
      </span>
      <div className="min-w-0 leading-tight">
        <div className={`truncate text-[19px] font-bold tabular-nums ${l.color}`}>{sign}{fmtNum(v)}{l.unit}</div>
        <div className="truncate text-[11px] text-muted">{l.label}</div>
      </div>
      <Sparks burst={done ? 1 : 0} />
    </div>
  )
}

/** Начисление награды: плашки с иконкой валюты, цифры накручиваются с нуля, в конце — искры. Нулевые значения не показываются. */
export function RewardPills({ capital = 0, xp = 0, reputation = 0 }: { capital?: number; xp?: number; reputation?: number }) {
  const items = ([['capital', capital], ['xp', xp], ['reputation', reputation]] as [Kind, number][]).filter(([, n]) => n !== 0)
  if (!items.length) return null
  return (
    <div className="mt-3 flex gap-2" aria-label={items.map(([k, n]) => `${n > 0 ? '+' : ''}${n} ${LOOK[k].label}`).join(', ')}>
      {items.map(([k, n], i) => <Pill key={k} kind={k} value={n} index={i} />)}
    </div>
  )
}
