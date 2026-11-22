import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { content } from '../content'
import { clearRankUp, onRankUp, peekRankUp, type RankUp } from '../game/events'
import { Button } from './ui'

// three.js нужен только для замка на высшем титуле
const ModelViewer = lazy(() => import('./ModelViewer'))

const BASE = import.meta.env.BASE_URL
const stageSrc = (n: number, v: 'p' | 'l') => `${BASE}art/stage-${Math.max(1, Math.min(7, n))}-${v}.webp`
/** Фон стадии: вертикальная картинка на телефоне, широкая на ПК (чтобы не было прямоугольника посреди экрана). */
const StageImg = ({ n, className }: { n: number; className: string }) => (
  <picture>
    <source media="(min-width: 768px)" srcSet={stageSrc(n, 'l')} />
    <img src={stageSrc(n, 'p')} alt="" className={className} onError={(ev) => (ev.currentTarget.style.display = 'none')} />
  </picture>
)

type Emblem = 'seal' | 'stamp' | 'coins' | 'key' | 'scroll' | 'banners' | 'castle'
type Fx = 'embers' | 'confetti' | 'coins' | 'petals'
type Theme = {
  /** как новый мир сменяет старый */
  reveal: 'circle' | 'wipe' | 'doors' | 'burst'
  emblem: Emblem
  fx: Fx[]
  /** подпись над названием */
  label: string
  vibe: number[]
  shake: number
  rays: number
  rings: number
  /** частота фейерверка (0 — нет) */
  fireworks: number
}

/** У каждого титула своя сцена, и с ростом грейда она мощнее: печать → монеты → двери → договор → знамёна → коронация. */
const THEMES: Record<number, Theme> = {
  1: { reveal: 'circle', emblem: 'seal', fx: ['embers'], label: 'Первый шаг', vibe: [40, 60, 40], shake: 0.4, rays: 0.5, rings: 1, fireworks: 0 },
  2: { reveal: 'wipe', emblem: 'stamp', fx: ['confetti'], label: 'Печать Дома', vibe: [70, 40, 110], shake: 0.9, rays: 0.6, rings: 1, fireworks: 0 },
  3: { reveal: 'circle', emblem: 'coins', fx: ['coins', 'embers'], label: 'Дом богатеет', vibe: [30, 30, 30, 30, 30, 30, 130], shake: 0.7, rays: 0.8, rings: 2, fireworks: 0 },
  4: { reveal: 'doors', emblem: 'key', fx: ['embers'], label: 'Двери открыты', vibe: [50, 260, 90], shake: 1.1, rays: 1, rings: 1, fireworks: 0 },
  5: { reveal: 'burst', emblem: 'scroll', fx: ['confetti', 'embers'], label: 'Договор скреплён', vibe: [40, 50, 40, 50, 40, 50, 160], shake: 1.2, rays: 1.1, rings: 3, fireworks: 0.7 },
  6: { reveal: 'burst', emblem: 'banners', fx: ['embers'], label: 'Знамёна подняты', vibe: [60, 60, 60, 60, 60, 60, 200], shake: 1.4, rays: 1.3, rings: 3, fireworks: 1.2 },
  7: { reveal: 'burst', emblem: 'castle', fx: ['petals', 'embers'], label: 'Коронация', vibe: [80, 50, 80, 50, 80, 50, 80, 300], shake: 1.8, rays: 1.7, rings: 4, fireworks: 2.2 },
}

/** Детерминированные «случайные» значения: кадр одинаков при каждом показе. */
const rnd = (i: number, m: number, a = 37, b = 11) => ((i * a + b) % m) / m
const EMBERS = Array.from({ length: 26 }, (_, i) => ({ left: (i * 37 + 11) % 100, delay: 1.2 + ((i * 53) % 30) / 10, dur: 2.6 + ((i * 29) % 18) / 10, size: 3 + (i % 4) }))
const CONFETTI_COLORS = ['#e8cd72', '#d0586b', '#52b890', '#5aa9f0', '#f1ebdd', '#a77bd2']
const CONFETTI = Array.from({ length: 44 }, (_, i) => ({ left: rnd(i, 97, 41, 7) * 100, delay: 1.1 + rnd(i, 53, 17, 3) * 2.4, dur: 2.4 + rnd(i, 31, 13, 5) * 2, w: 6 + (i % 4) * 2, h: 10 + (i % 3) * 4, c: CONFETTI_COLORS[i % CONFETTI_COLORS.length] }))
const COINS = Array.from({ length: 20 }, (_, i) => ({ left: 4 + rnd(i, 89, 29, 9) * 92, delay: 1.0 + rnd(i, 43, 19, 5) * 2.2, dur: 2.2 + rnd(i, 23, 11, 3) * 1.4, s: 18 + (i % 3) * 5 }))
const PETALS = Array.from({ length: 30 }, (_, i) => ({ left: rnd(i, 83, 31, 13) * 100, delay: 1.4 + rnd(i, 47, 23, 7) * 3, dur: 4 + rnd(i, 29, 7, 3) * 3, s: 8 + (i % 4) * 3, c: i % 3 === 0 ? '#f6c1cf' : i % 3 === 1 ? '#e8cd72' : '#ffffff' }))

/** Фейерверк на canvas: вспышки по экрану, частицы с гравитацией и затуханием. */
function Fireworks({ rate }: { rate: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = c.clientWidth * dpr
    c.height = c.clientHeight * dpr
    type P = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
    const ps: P[] = []
    const colors = ['#ffe28c', '#ffb347', '#ff6b6b', '#8fd3ff', '#ffffff', '#c9a6ff']
    const burst = () => {
      const cx = (0.15 + Math.random() * 0.7) * c.width
      const cy = (0.1 + Math.random() * 0.42) * c.height
      const col = colors[(Math.random() * colors.length) | 0]
      const n = 46
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2
        const sp = (1.8 + Math.random() * 3.2) * dpr
        ps.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color: col, size: (1.5 + Math.random() * 1.5) * dpr })
      }
    }
    let raf = 0
    let last = performance.now()
    let acc = 0
    const start = last + 1500
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(50, now - last)
      last = now
      if (now > start) { acc += dt; if (acc > 720 / rate) { acc = 0; burst() } }
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.globalCompositeOperation = 'lighter'
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]
        p.vy += 0.055 * dpr * (dt / 16)
        p.x += p.vx * (dt / 16)
        p.y += p.vy * (dt / 16)
        p.vx *= 0.992
        p.life -= dt / 1100
        if (p.life <= 0) { ps.splice(i, 1); continue }
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [rate])
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
}

const CrownSvg = ({ w = 116 }: { w?: number }) => (
  <svg width={w} height={w * 0.76} viewBox="0 0 120 90" aria-hidden><path d="M10 70 22 20l24 30 14-40 14 40 24-30 12 50z" fill="currentColor" /><rect x="10" y="74" width="100" height="10" fill="currentColor" /></svg>
)

/** Восковая печать: симметричный край с мягкими волнами вокруг центра (60, 60) */
const WAX_PATH = (() => {
  const pts: string[] = []
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2
    const r = 52 + 2.6 * Math.sin(a * 8)
    pts.push((i ? 'L' : 'M') + (60 + r * Math.cos(a)).toFixed(2) + ' ' + (60 + r * Math.sin(a)).toFixed(2))
  }
  return pts.join('') + 'Z'
})()

/** Эмблемы: у каждого титула свой символ. */
function EmblemView({ kind }: { kind: Emblem }) {
  switch (kind) {
    case 'seal':
    case 'stamp':
      return (
        <div className={`${kind === 'stamp' ? 'cer-stamp' : 'cer-crown'} drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)]`}>
          <svg width="116" height="116" viewBox="0 0 120 120" aria-hidden>
            <defs><radialGradient id="wax" cx="40%" cy="35%"><stop offset="0" stopColor="#e0525c" /><stop offset="1" stopColor="#8e1c27" /></radialGradient></defs>
            <path d={WAX_PATH} fill="url(#wax)" />
            <circle cx="60" cy="60" r="38" fill="none" stroke="#f3a0a6" strokeOpacity="0.55" strokeWidth="2.5" />
            <g transform="translate(34 40) scale(0.43)" fill="#ffe9ea"><path d="M10 70 22 20l24 30 14-40 14 40 24-30 12 50z" /><rect x="10" y="74" width="100" height="10" /></g>
          </svg>
        </div>
      )
    case 'coins':
      return (
        <div className="cer-crown drop-shadow-[0_0_22px_rgba(232,205,114,0.7)]">
          <svg width="120" height="104" viewBox="0 0 120 104" aria-hidden>
            <defs><linearGradient id="coin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1b0" /><stop offset="0.5" stopColor="#e0b84e" /><stop offset="1" stopColor="#a67f17" /></linearGradient></defs>
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i} transform={`translate(${i % 2 ? 6 : 0} ${72 - i * 15})`}>
                <ellipse cx="55" cy="14" rx="44" ry="13" fill="#8a6a12" />
                <rect x="11" y="0" width="88" height="14" fill="url(#coin)" />
                <ellipse cx="55" cy="0" rx="44" ry="13" fill="url(#coin)" />
                <ellipse cx="55" cy="0" rx="32" ry="8.5" fill="none" stroke="#a67f17" strokeWidth="2" />
              </g>
            ))}
          </svg>
        </div>
      )
    case 'key':
      return (
        <div className="cer-key text-gold-soft drop-shadow-[0_0_26px_rgba(232,205,114,0.85)]">
          <svg width="130" height="130" viewBox="0 0 130 130" aria-hidden fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="42" cy="42" r="26" /><circle cx="42" cy="42" r="9" fill="currentColor" stroke="none" />
            <path d="M61 61 112 112M92 92l14-14M80 104l12-12" />
          </svg>
        </div>
      )
    case 'scroll':
      return (
        <div className="cer-crown drop-shadow-[0_8px_20px_rgba(0,0,0,0.55)]">
          <svg width="150" height="126" viewBox="0 0 150 126" aria-hidden>
            <rect x="12" y="10" width="126" height="92" rx="6" fill="#efe2bd" />
            <rect x="4" y="4" width="142" height="14" rx="7" fill="#c9a227" /><rect x="4" y="94" width="142" height="14" rx="7" fill="#c9a227" />
            <g stroke="#7b6a43" strokeWidth="3" strokeLinecap="round" fill="none">
              {[34, 48, 62].map((y, i) => <path key={y} className="cer-draw" style={{ animationDelay: `${1.25 + i * 0.22}s` }} pathLength={1} d={`M30 ${y}H${i === 2 ? 96 : 120}`} />)}
              <path className="cer-draw" style={{ animationDelay: '2s' }} pathLength={1} stroke="#2a3f86" d="M32 84c8-14 12 10 20-4s8 8 16-2 10 6 18-3" />
            </g>
            <g className="cer-pop" style={{ animationDelay: '2.5s' }}>
              <circle cx="112" cy="84" r="15" fill="#b3262d" /><circle cx="112" cy="84" r="9" fill="none" stroke="#f3a0a6" strokeOpacity="0.6" strokeWidth="2" />
            </g>
          </svg>
        </div>
      )
    case 'banners':
      return (
        <div className="cer-crown text-gold-soft drop-shadow-[0_0_24px_rgba(232,205,114,0.8)]">
          <CrownSvg />
        </div>
      )
    case 'castle':
      return (
        <div className="relative">
          <div className="cer-castle">
            <Suspense fallback={<div className="h-[210px] w-[240px]" />}>
              <ModelViewer name="castle" className="h-[210px] w-[240px]" />
            </Suspense>
          </div>
          <div className="cer-crown-late absolute -top-6 left-1/2 -ml-[41px] text-gold-soft drop-shadow-[0_0_26px_rgba(255,226,140,0.95)]"><CrownSvg w={82} /></div>
        </div>
      )
  }
}

/** Знамя для высших титулов: свисает сверху и покачивается. */
const Banner = ({ side }: { side: 'l' | 'r' }) => (
  <div className={`cer-banner pointer-events-none absolute top-0 ${side === 'l' ? 'left-5' : 'right-5'}`} style={{ animationDelay: side === 'l' ? '1.2s' : '1.4s' }}>
    <svg width="64" height="190" viewBox="0 0 64 190" aria-hidden>
      <rect x="0" y="0" width="64" height="6" fill="#c9a227" />
      <path d="M4 6h56v150l-28-24-28 24z" fill="#a8283a" stroke="#e8cd72" strokeWidth="3" />
      <g transform="translate(14 44) scale(0.3)" fill="#f6dc86"><path d="M10 70 22 20l24 30 14-40 14 40 24-30 12 50z" /><rect x="10" y="74" width="100" height="10" /></g>
    </svg>
  </div>
)

/** Церемония нового титула: у каждого грейда свой сценарий (печать, монеты, двери, договор, знамёна, коронация). */
export function RankCeremony() {
  const [e, setE] = useState<RankUp | null>(() => peekRankUp())
  const [ready, setReady] = useState(false)
  useEffect(() => { const u = peekRankUp(); if (u) setE(u); return onRankUp(setE) }, [])

  const theme = THEMES[e?.rank ?? 1] ?? THEMES[1]
  // кнопка появляется после основной сцены; вибрация на ударе
  useEffect(() => {
    if (!e) { setReady(false); return }
    const t1 = setTimeout(() => navigator.vibrate?.(theme.vibe), 450)
    const t2 = setTimeout(() => setReady(true), e.rank >= 5 ? 4200 : 3600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [e, theme])

  if (!e) return null
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const unlocked = content.empire.buildings.filter((b) => b.minRank === e.rank && b.cost > 0)
  // слова не рвём посреди: каждое слово — неразрывный блок, внутри буквы появляются по очереди
  let idx = 0
  const words = e.title.split(' ').map((w) => [...w].map((ch) => ({ ch, i: idx++ })))
  const big = e.rank >= 7
  const reveal = theme.reveal === 'burst' ? 'circle' : theme.reveal

  return (
    <div className="cer fixed inset-0 z-50 overflow-hidden bg-ink" role="dialog" aria-label="Новый титул" style={{ ['--shake' as string]: theme.shake }}>
      {/* старый мир → новый мир */}
      {reveal !== 'doors' && <StageImg n={e.rank - 1} className="cer-old absolute inset-0 h-full w-full object-cover" />}
      <StageImg n={e.rank} className={`absolute inset-0 h-full w-full object-cover ${reveal === 'circle' ? 'cer-new' : reveal === 'wipe' ? 'cer-new-wipe' : 'cer-new-static'}`} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(90% 60% at 50% 42%, rgba(17,17,20,0.15) 0%, rgba(17,17,20,0.78) 100%)' }} />

      {reveal === 'wipe' && <div className="cer-wipe-line pointer-events-none absolute inset-x-0" />}
      {reveal === 'doors' && (
        <>
          <div className="cer-door cer-door-l pointer-events-none absolute inset-y-0 left-0 w-1/2" />
          <div className="cer-door cer-door-r pointer-events-none absolute inset-y-0 right-0 w-1/2" />
          <div className="cer-beam pointer-events-none absolute inset-y-0 left-1/2" />
        </>
      )}

      {/* лучи света, вспышка и волны */}
      <div className="cer-rays pointer-events-none absolute left-1/2 top-[38%]" style={{ ['--rays' as string]: theme.rays }} />
      <div className="cer-flash pointer-events-none absolute inset-0" />
      {Array.from({ length: theme.rings }, (_, i) => <div key={i} className="cer-ring pointer-events-none absolute left-1/2 top-[38%]" style={{ animationDelay: `${0.4 + i * 0.28}s` }} />)}

      {/* частицы */}
      {theme.fx.includes('embers') && EMBERS.map((m, i) => <i key={`e${i}`} className="cer-ember pointer-events-none absolute top-0" style={{ left: `${m.left}%`, width: m.size, height: m.size, animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s` }} />)}
      {theme.fx.includes('confetti') && CONFETTI.map((m, i) => <i key={`c${i}`} className="cer-confetti pointer-events-none absolute top-0" style={{ left: `${m.left}%`, width: m.w, height: m.h, background: m.c, animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s` }} />)}
      {theme.fx.includes('coins') && COINS.map((m, i) => <i key={`k${i}`} className="cer-coin pointer-events-none absolute top-0" style={{ left: `${m.left}%`, width: m.s, height: m.s, animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s` }} />)}
      {theme.fx.includes('petals') && PETALS.map((m, i) => <i key={`p${i}`} className="cer-petal pointer-events-none absolute top-0" style={{ left: `${m.left}%`, width: m.s, height: m.s * 1.4, background: m.c, animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s` }} />)}
      {theme.fireworks > 0 && !reduce && <Fireworks rate={theme.fireworks} />}
      {theme.emblem === 'banners' && <><Banner side="l" /><Banner side="r" /></>}

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-8 text-center">
        <EmblemView kind={theme.emblem} />
        <div className="cer-label mt-5 text-[12px] font-semibold uppercase tracking-[0.3em] text-gold-soft">{theme.label}</div>
        <h2 className={`mt-3 font-serif leading-[1.05] ${big ? 'text-[46px]' : 'text-[40px]'}`} aria-label={e.title}>
          {words.map((w, wi) => (
            <span key={wi} className="inline-block whitespace-nowrap">
              {w.map(({ ch, i }) => (
                <span key={i} className="cer-letter gold-text inline-block" style={{ animationDelay: `${1.7 + i * 0.045}s` }} aria-hidden>{ch}</span>
              ))}
              {wi < words.length - 1 && ' '}
            </span>
          ))}
        </h2>
        <p className="cer-text mt-4 text-[16px] leading-relaxed text-parch/90" style={{ animationDelay: '2.9s' }}>Титул получен за реальный результат. Его не отнять.</p>
        {unlocked.length > 0 && (
          <div className="cer-text mt-4 flex flex-wrap justify-center gap-2" style={{ animationDelay: '3.1s' }}>
            <span className="w-full text-[11px] uppercase tracking-[0.2em] text-muted">Теперь доступно</span>
            {unlocked.map((b) => <span key={b.id} className="rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-[13px] text-gold-soft">{b.title}</span>)}
          </div>
        )}
        <Button className={`mt-9 w-full max-w-xs transition-opacity duration-500 ${ready ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => { clearRankUp(); setE(null) }}>Принять титул</Button>
      </div>
    </div>
  )
}
