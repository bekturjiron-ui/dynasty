import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'gold' | 'ghost' | 'quiet'; full?: boolean }

export function Button({ variant = 'gold', full, className = '', ...rest }: BtnProps) {
  const base = 'min-h-12 rounded-xl px-5 text-[16px] font-semibold transition duration-150 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100'
  const look =
    variant === 'gold'
      ? 'btn-gold text-ink'
      : variant === 'ghost'
        ? 'border border-gold/60 text-gold-soft active:bg-gold/10'
        : 'text-muted'
  return <button className={`${base} ${look} ${full ? 'w-full' : ''} ${className}`} {...rest} />
}

export type Tone = 'plain' | 'gold' | 'boss' | 'contract' | 'copper'
const SURFACE: Record<Tone, string> = {
  plain: 'surface border-line',
  gold: 'surface-gold',
  boss: 'surface-boss',
  contract: 'surface-contract',
  copper: 'surface-copper',
}

/** Карточка. tone задаёт цветовой акцент по типу задачи: урок — золото, босс — рубин, контракт — изумруд, переговоры — медь. */
export function Card({ children, className = '', onClick, tone = 'plain' }: { children: ReactNode; className?: string; onClick?: () => void; tone?: Tone }) {
  return (
    <div onClick={onClick} className={`rounded-2xl border p-4 ${SURFACE[tone]} ${onClick ? 'cursor-pointer transition active:brightness-125' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function Label({ children, tone }: { children: ReactNode; tone?: Exclude<Tone, 'plain'> }) {
  const color = tone === 'gold' ? 'text-gold-soft' : tone === 'boss' ? 'text-ruby' : tone === 'contract' ? 'text-emerald' : tone === 'copper' ? 'text-copper' : 'text-muted'
  return <div className={`text-[11.5px] font-semibold uppercase tracking-[0.14em] ${color}`}>{children}</div>
}

export function Bar({ value, className = '' }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={`h-2.5 overflow-hidden rounded-full bg-black/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)] ${className}`}>
      <div className={`h-full rounded-full bg-gradient-to-r from-[#9c7c17] via-gold to-gold-soft transition-[width] duration-700 ease-out ${v > 0 ? 'bar-shine' : ''}`} style={{ width: `${v * 100}%` }} />
    </div>
  )
}

/** Число плавно «накручивается» до значения. При смене значения идёт от прошлого к новому. */
export function useCountUp(target: number, ms = 800) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || from.current === target) { from.current = target; setV(target); return }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      setV(Math.round(a + (target - a) * e))
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

/** Золотые искры: показать на миг, когда сменился key (награда получена). */
export function Sparks({ burst }: { burst: number }) {
  const [show, setShow] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setShow(true)
    const t = setTimeout(() => setShow(false), 950)
    return () => clearTimeout(t)
  }, [burst])
  if (!show) return null
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => {
        const ang = (i / 10) * Math.PI * 2
        return <i key={i} className="spark left-1/2 top-1/2" style={{ ['--dx' as string]: `${Math.cos(ang) * 46}px`, ['--dy' as string]: `${Math.sin(ang) * 30}px` }} />
      })}
    </span>
  )
}

export function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-serif text-[26px] leading-tight text-parch ${className}`}>{children}</h1>
}

/** Доклад советника: результат в ₸, без оценок личности. */
export function Advisor({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gain' | 'loss' }) {
  const border = tone === 'gain' ? 'border-gain/60' : tone === 'loss' ? 'border-loss/60' : 'border-gold/40'
  return (
    <div className={`animate-rise rounded-2xl border ${border} bg-panel2 p-4`}>
      <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-gold">
        <Seal /> Доклад советника
      </div>
      <div className="text-[15px] leading-relaxed text-parch">{children}</div>
    </div>
  )
}

export function Seal({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.5 10.5 9.5 7l2.5 3 2.5-3 2 3.5v2h-9z" fill="currentColor" />
    </svg>
  )
}

export function Icon({ name, size = 24 }: { name: 'coin' | 'star' | 'crown' | 'today' | 'plan' | 'empire' | 'arsenal' | 'council' | 'close' | 'check' | 'lock' | 'shield' | 'flame' | 'photo'; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
    case 'coin':
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 8.5h7M12 8.5v7.5M9.5 12h5" /></svg>
    case 'star':
      return <svg {...p}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
    case 'crown':
      return <svg {...p}><path d="M4 18 3 7l5 4 4-6 4 6 5-4-1 11zM4 21h16" /></svg>
    case 'today':
      return <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
    case 'plan':
      return <svg {...p}><path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6" /><path d="M6 3a2 2 0 0 0-2 2v1h4V5a2 2 0 0 0-2-2zM6 21a2 2 0 0 1-2-2v-1h4v1a2 2 0 0 1-2 2zM10 8h6M10 12h6M10 16h4" /></svg>
    case 'empire':
      return <svg {...p}><path d="M3 21h18M5 21V10l3-2 3 2v11M13 21V6l3-3 3 3v15M8 13v2M16 9v2M16 14v2" /></svg>
    case 'arsenal':
      return <svg {...p}><rect x="4" y="6" width="12" height="15" rx="2" /><path d="M8 3h10a2 2 0 0 1 2 2v13" /><path d="M7.5 11h5M7.5 15h5" /></svg>
    case 'council':
      return <svg {...p}><path d="M3 9 12 4l9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18" /></svg>
    case 'close':
      return <svg {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
    case 'check':
      return <svg {...p}><path d="m5 12.5 4.5 4.5L19 7" /></svg>
    case 'lock':
      return <svg {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
    case 'shield':
      return <svg {...p}><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" /></svg>
    case 'flame':
      return <svg {...p}><path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z" /></svg>
    case 'photo':
      return <svg {...p}><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></svg>
  }
}
