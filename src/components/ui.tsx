import type { ButtonHTMLAttributes, ReactNode } from 'react'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'gold' | 'ghost' | 'quiet'; full?: boolean }

export function Button({ variant = 'gold', full, className = '', ...rest }: BtnProps) {
  const base = 'min-h-12 rounded-xl px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100'
  const look =
    variant === 'gold'
      ? 'bg-gold text-ink shadow-[0_0_0_1px_rgba(255,230,150,0.25)_inset]'
      : variant === 'ghost'
        ? 'border border-gold/50 text-gold'
        : 'text-muted'
  return <button className={`${base} ${look} ${full ? 'w-full' : ''} ${className}`} {...rest} />
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-2xl border border-line bg-panel p-4 ${onClick ? 'cursor-pointer active:bg-panel2' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{children}</div>
}

export function Bar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-line ${className}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-[#9c7c17] to-gold-soft transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
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

export function Icon({ name, size = 24 }: { name: 'today' | 'plan' | 'empire' | 'arsenal' | 'council' | 'close' | 'check' | 'lock' | 'shield' | 'flame' | 'photo'; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
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
