import { useState } from 'react'

const BASE = import.meta.env.BASE_URL

/** Силуэт города для стадии n (1…7), пока нет иллюстраций. Чем выше титул, тем больше построек; с 6-й стадии на холме растёт замок. */
function Skyline({ n }: { n: number }) {
  const houses = [
    { x: 40, w: 34, h: 26 },
    { x: 96, w: 40, h: 34 },
    { x: 150, w: 30, h: 44 },
    { x: 196, w: 44, h: 38 },
    { x: 252, w: 36, h: 52 },
    { x: 300, w: 40, h: 40 },
    { x: 346, w: 30, h: 30 },
  ].slice(0, Math.min(7, n + 1))
  const castle = n >= 6
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="sk-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b1720" /><stop offset="1" stopColor="#111114" /></linearGradient>
        <radialGradient id="sk-win"><stop offset="0" stopColor="#ffd98a" /><stop offset="1" stopColor="#ffd98a" stopOpacity="0" /></radialGradient>
      </defs>
      <path d="M0 200 Q80 170 160 186 T400 176 V220 H0z" fill="url(#sk-ground)" />
      {castle && (
        <g fill="#241e2a" opacity={n >= 7 ? 1 : 0.7}>
          <rect x="150" y={n >= 7 ? 60 : 96} width="100" height={n >= 7 ? 110 : 74} />
          <rect x="136" y={n >= 7 ? 40 : 84} width="22" height={n >= 7 ? 132 : 90} />
          <rect x="242" y={n >= 7 ? 40 : 84} width="22" height={n >= 7 ? 132 : 90} />
          <path d={`M132 ${n >= 7 ? 40 : 84}l15-26 15 26zM238 ${n >= 7 ? 40 : 84}l15-26 15 26z`} />
          {n >= 7 && <path d="M180 60l20-40 20 40z" />}
        </g>
      )}
      {houses.map((h, i) => {
        const base = 186 - (i % 2) * 6
        return (
          <g key={i}>
            <rect x={h.x} y={base - h.h} width={h.w} height={h.h} fill="#2a2430" />
            <path d={`M${h.x - 3} ${base - h.h}l${h.w / 2 + 3} -14 ${h.w / 2 + 3} 14z`} fill="#34283a" />
            <circle cx={h.x + h.w / 2} cy={base - h.h / 2} r="7" fill="url(#sk-win)" className="sk-flicker" style={{ animationDelay: `${i * 0.7}s` }} />
          </g>
        )
      })}
    </svg>
  )
}

/** Фон-мир: растёт с титулом. Если лежат картинки public/art/stage-N-p|l.webp — показывает их, иначе силуэт. */
export function StageBackdrop({ stage }: { stage: number }) {
  const n = Math.max(1, Math.min(7, stage))
  const [loaded, setLoaded] = useState<number | null>(null)
  const img = loaded === n
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[38dvh] md:h-[52dvh] overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#2a1f33 0%,#5a3a3a 55%,#c98a3f 100%)', opacity: 0.55 }} />
      <div key={`sil-${n}`} className="fade-in absolute inset-0" style={{ opacity: img ? 0 : 1 }}>
        <Skyline n={n} />
      </div>
      <picture key={`img-${n}`} className="fade-in absolute inset-0">
        <source media="(min-width: 768px)" srcSet={`${BASE}art/stage-${n}-l.webp`} />
        <img src={`${BASE}art/stage-${n}-p.webp`} alt="" onLoad={() => setLoaded(n)} onError={() => setLoaded(null)} className="h-full w-full object-cover" style={{ opacity: img ? 1 : 0, objectPosition: "50% 62%" }} />
      </picture>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(17,17,20,0.35) 0%, rgba(17,17,20,0.55) 45%, #111114 100%)' }} />
    </div>
  )
}
