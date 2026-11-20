import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { foundHouse } from './game/engine'
import { onRankUp, type RankUp } from './game/events'
import { useGame, type Game } from './game/useGame'
import { Button, Icon, Label } from './components/ui'
import Today from './screens/Today'
import Plan from './screens/Plan'
// Империя тянет Recharts — грузим её отдельным куском, только когда открыли вкладку
const Empire = lazy(() => import('./screens/Empire'))
import Arsenal from './screens/Arsenal'
// Совет тоже тянет графики — отдельным куском
const Council = lazy(() => import('./screens/Council'))
import LessonScreen from './screens/Lesson'
import BossScreen from './screens/Boss'
import NegotiationScreen from './screens/Negotiation'

const TABS = [
  { to: '/', label: 'Сегодня', icon: 'today' },
  { to: '/plan', label: 'План', icon: 'plan' },
  { to: '/empire', label: 'Империя', icon: 'empire' },
  { to: '/arsenal', label: 'Арсенал', icon: 'arsenal' },
  { to: '/council', label: 'Совет', icon: 'council' },
] as const

export default function App() {
  const game = useGame()
  const loc = useLocation()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [loc.pathname])

  if (game.loading) return <div className="min-h-dvh bg-ink" />
  if (!game.player) return <Welcome />

  const tab = (el: (g: Game) => ReactNode) => <Shell>{el(game)}</Shell>
  return (
    <>
      <Routes>
        <Route path="/" element={tab((g) => <Today game={g} />)} />
        <Route path="/plan" element={tab((g) => <Plan game={g} />)} />
        <Route path="/empire" element={tab((g) => <Suspense fallback={<div className="pt-10 text-center text-muted">Открываем карту…</div>}><Empire game={g} /></Suspense>)} />
        <Route path="/arsenal" element={tab((g) => <Arsenal game={g} />)} />
        <Route path="/council" element={tab((g) => <Suspense fallback={<div className="pt-10 text-center text-muted">Собираем Совет…</div>}><Council game={g} /></Suspense>)} />
        <Route path="/lesson/:id" element={<LessonScreen />} />
        <Route path="/boss/:id" element={<BossScreen />} />
        <Route path="/negotiation/:id" element={<NegotiationScreen />} />
        <Route path="*" element={tab((g) => <Today game={g} />)} />
      </Routes>
      <RankCeremony />
    </>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <main className="pt-safe px-4 pb-28">{children}</main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-10 border-t border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end className={({ isActive }) => `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] ${isActive ? 'text-gold' : 'text-muted'}`}>
              <Icon name={t.icon} size={22} />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

function Welcome() {
  const [name, setName] = useState('')
  const isIos = /iPhone|iPad/.test(navigator.userAgent)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone
  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 pb-10">
      <img src="./icons/icon-192.png" alt="" className="mx-auto h-24 w-24 rounded-3xl" />
      <h1 className="gold-text mt-6 text-center font-serif text-[40px] leading-none">Династия</h1>
      <p className="mt-4 text-center text-[16px] leading-relaxed text-parch/90">
        24 недели: от Посыльного до Главы Дома. Титулы здесь не покупаются кликами — только верным расчётом, сданной таблицей, реальной сделкой.
      </p>
      <div className="mt-8 space-y-3">
        <Label>Как назовём твой Дом?</Label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Дом Сериковых" className="min-h-12 w-full rounded-xl border border-line bg-panel px-4 outline-none focus:border-gold" />
        <Button full onClick={() => foundHouse(name)}>Основать Дом</Button>
      </div>
      {isIos && !standalone && (
        <p className="mt-6 text-center text-[13px] leading-relaxed text-muted">Чтобы играть как в приложении: «Поделиться» → «На экран „Домой“».</p>
      )}
    </div>
  )
}

function RankCeremony() {
  const [e, setE] = useState<RankUp | null>(null)
  useEffect(() => onRankUp(setE), [])
  if (!e) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/95 px-8 text-center backdrop-blur" role="dialog" aria-label="Новый титул">
      <div className="animate-crown text-gold"><svg width="120" height="90" viewBox="0 0 120 90" aria-hidden><path d="M10 70 22 20l24 30 14-40 14 40 24-30 12 50z" fill="currentColor" /><rect x="10" y="74" width="100" height="10" fill="currentColor" /></svg></div>
      <Label>Совет Дома объявляет</Label>
      <div className="gold-text mt-3 font-serif text-[42px] leading-tight">{e.title}</div>
      <p className="mt-4 text-[16px] leading-relaxed text-parch/90">Титул получен за реальный результат. Его не отнять.</p>
      <Button className="mt-10 w-full max-w-xs" onClick={() => setE(null)}>Принять титул</Button>
    </div>
  )
}
