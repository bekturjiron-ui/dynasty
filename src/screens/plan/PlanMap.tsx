import { useEffect, useMemo, useRef, useState } from 'react'
import type { WeekStatus } from '../../game/engine'
import type { Game } from '../../game/useGame'
import { BossToken, type BossState } from '../../components/BossToken'
import { Icon } from '../../components/ui'

const BASE = import.meta.env.BASE_URL
const W = 390
const STEP = 150
const TOP = 100
const SEEN_KEY = 'dynasty-plan-seen'

const xOf = (i: number) => (i % 2 === 0 ? 105 : 285)
const yOf = (i: number) => TOP + i * STEP
const height = (n: number) => TOP + (n - 1) * STEP + 140

/** Змейка через все пункты: каждый отрезок плавно перетекает в следующий. */
function roadPath(n: number) {
  let d = `M${xOf(0)} ${yOf(0)}`
  for (let i = 1; i < n; i++) d += ` C${xOf(i - 1)} ${yOf(i - 1) + 80} ${xOf(i)} ${yOf(i) - 80} ${xOf(i)} ${yOf(i)}`
  return d
}

function bossState(s: WeekStatus, game: Game): BossState {
  const w = s.week
  // Переговоры закрыты до конца уроков, даже если диалог уже успели сыграть
  if (w.negotiationId && game.content.negotiations[w.negotiationId]) return !s.bossUnlocked ? 'locked' : game.negotiations.has(w.negotiationId) ? 'done' : 'ready'
  if (s.bossReady) return s.bossDone ? 'done' : s.bossUnlocked ? 'ready' : 'locked'
  return 'locked'
}

const readSeen = () => { try { return new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) } catch { return new Set<string>() } }

function Plinth({ state }: { state: BossState }) {
  const [ok, setOk] = useState(true)
  return (
    <span className="pm-plinth" data-state={state} aria-hidden>
      {ok ? <img src={`${BASE}art/plan/plinth.webp`} alt="" draggable={false} onError={() => setOk(false)} /> : <span className="pm-plinth-css" />}
    </span>
  )
}

/** Вертикальная карта плана: дорога-змейка, на каждом пункте босс недели. */
export function PlanMap({ game, statuses, focusKey, onOpen }: { game: Game; statuses: WeekStatus[]; focusKey?: number; onOpen: (key: number) => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const n = statuses.length
  const H = height(n)
  const focusIdx = Math.max(0, statuses.findIndex((s) => (s.week.key ?? s.week.n) === focusKey))
  const states = statuses.map((s) => bossState(s, game))
  const [drawn, setDrawn] = useState(false)

  // Кто проснулся с прошлого открытия карты. Считается один раз при входе, чтобы анимация не повторялась.
  const woke = useMemo(() => {
    const seen = readSeen()
    return new Set(statuses.filter((s, i) => states[i] === 'ready' && !seen.has(String(s.week.bossId ?? s.week.negotiationId))).map((s) => s.week.key ?? s.week.n))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => {
      const seen = readSeen()
      statuses.forEach((s, i) => { if (states[i] !== 'locked') seen.add(String(s.week.bossId ?? s.week.negotiationId)) })
      try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])) } catch { /* без хранилища просто проиграем ещё раз */ }
    }, 2500)
    return () => clearTimeout(t)
  }, [statuses, states])

  // Дорога дорисовывается до текущей недели
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(() => setDrawn(true), reduce ? 0 : 250)
    return () => clearTimeout(t)
  }, [])

  // Прокрутка: параллакс тумана и «обложка» (центральные пункты крупнее и ярче)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const flows = [...root.querySelectorAll<HTMLElement>('.pm-flow')]
    const reveals = [...root.querySelectorAll<HTMLElement>('.pm-reveal')]
    let raf = 0
    const frame = () => {
      raf = 0
      const vh = window.innerHeight
      const rects = flows.map((el) => el.getBoundingClientRect())
      root.style.setProperty('--sy', String(Math.round(window.scrollY)))
      rects.forEach((r, i) => {
        const d = Math.min(1, Math.abs(r.top + r.height / 2 - vh / 2) / (vh * 0.62))
        flows[i].style.setProperty('--d', reduce ? '0' : d.toFixed(3))
      })
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame) }
    frame()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { (e.target as HTMLElement).classList.add('in'); io.unobserve(e.target) }
    }, { threshold: 0.15 })
    reveals.forEach((el, i) => { el.style.setProperty('--i', String(i % 4)); io.observe(el) })

    // Открыли карту: плавно показываем текущую неделю
    const focusEl = root.querySelector<HTMLElement>('[data-focus="1"]')
    const t = focusIdx > 1 && focusEl ? setTimeout(() => focusEl.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }), 350) : 0
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      io.disconnect()
      if (t) clearTimeout(t)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={rootRef} className="pm-root relative z-[1] mx-auto w-full max-w-[440px]" style={{ aspectRatio: `${W} / ${H}` }}>
      <div className="pm-fog pm-fog-a" aria-hidden />
      <div className="pm-fog pm-fog-b" aria-hidden />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d={roadPath(n)} fill="none" stroke="rgba(10,10,13,0.75)" strokeWidth="22" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={roadPath(n)} fill="none" stroke="rgba(120,112,98,0.55)" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 11" vectorEffect="non-scaling-stroke" />
        <path d={roadPath(n)} fill="none" stroke="#e0b84e" strokeWidth="4" strokeLinecap="round" pathLength={n - 1} strokeDasharray={`${drawn ? focusIdx : 0} ${n}`} className="pm-road-gold" vectorEffect="non-scaling-stroke" />
      </svg>

      {statuses.map((s, i) => {
        const w = s.week
        const key = w.key ?? w.n
        const state = states[i]
        const isFocus = key === focusKey
        const left = xOf(i) < W / 2
        const art = w.bossId ?? w.negotiationId ?? null
        const sub = s.complete ? 'неделя пройдена' : state === 'ready' ? 'босс ждёт' : s.lessonsTotal ? `уроки ${s.lessonsDone}/${s.lessonsTotal}` : 'уроки готовятся'
        return (
          <div key={key} className="pm-node" style={{ left: `${(xOf(i) / W) * 100}%`, top: `${(yOf(i) / H) * 100}%` }}>
            <div className="pm-reveal">
              <div className="pm-flow">
                <button
                  className="pm-btn"
                  data-state={state}
                  data-pm-ready={state === 'ready' ? '1' : undefined}
                  data-focus={isFocus ? '1' : undefined}
                  onClick={() => onOpen(key)}
                  aria-label={`Неделя ${w.n}: ${w.title}. ${sub}`}
                >
                  <Plinth state={state} />
                  <BossToken art={art} state={state} woke={woke.has(key)} title={w.bossTitle} />
                  <span className={`pm-num${isFocus ? ' focus' : ''}${s.complete ? ' done' : ''}`}>{s.complete ? <Icon name="check" size={13} /> : w.n}</span>
                </button>
                <div className={`pm-label ${left ? 'right' : 'left'}`}>
                  <span className="pm-label-title">{w.title}</span>
                  <span className={`pm-label-sub ${state}`}>{sub}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
