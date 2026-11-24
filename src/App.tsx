import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { foundHouse } from './game/engine'
import { useGame, type Game } from './game/useGame'
import { Button, Icon, Label, Seal } from './components/ui'
import { GlossaryProvider } from './components/Glossary'
import { RankCeremony } from './components/RankCeremony'
import { ResourceBar } from './components/ResourceBar'
import { VersionBadge } from './components/ChangelogModal'
import { StageBackdrop } from './components/StageBackdrop'
import Today from './screens/Today'
import Plan from './screens/Plan'
// Империя тянет Recharts — грузим её отдельным куском, только когда открыли вкладку
const Empire = lazy(() => import('./screens/Empire'))
import Arsenal from './screens/Arsenal'
// Совет тоже тянет графики — отдельным куском
const Council = lazy(() => import('./screens/Council'))
// Админ-панель нужна редко: отдельный кусок
const Admin = lazy(() => import('./screens/Admin'))
import Case from './screens/Case'
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

  const tab = (el: (g: Game) => ReactNode) => <Shell game={game}>{el(game)}</Shell>
  return (
    <GlossaryProvider>
      <Routes>
        <Route path="/" element={tab((g) => <Today game={g} />)} />
        <Route path="/plan" element={tab((g) => <Plan game={g} />)} />
        <Route path="/empire" element={tab((g) => <Suspense fallback={<div className="pt-10 text-center text-muted">Открываем карту…</div>}><Empire game={g} /></Suspense>)} />
        <Route path="/arsenal" element={tab((g) => <Arsenal game={g} />)} />
        <Route path="/council" element={tab((g) => <Suspense fallback={<div className="pt-10 text-center text-muted">Собираем Совет…</div>}><Council game={g} /></Suspense>)} />
        <Route path="/admin" element={tab((g) => <Suspense fallback={null}><Admin game={g} /></Suspense>)} />
        <Route path="/case" element={tab((g) => <Case game={g} />)} />
        <Route path="/lesson/:id" element={<LessonScreen />} />
        <Route path="/boss/:id" element={<BossScreen />} />
        <Route path="/negotiation/:id" element={<NegotiationScreen />} />
        <Route path="*" element={tab((g) => <Today game={g} />)} />
      </Routes>
      <RankCeremony />
    </GlossaryProvider>
  )
}

function Shell({ children, game }: { children: ReactNode; game: Game }) {
  const loc = useLocation()
  const p = game.player
  const link = (vertical: boolean) => ({ isActive }: { isActive: boolean }) =>
    vertical
      ? `flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors ${isActive ? 'tab-active bg-gold/15 text-gold-soft' : 'text-muted hover:text-parch'}`
      : `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${isActive ? 'tab-active text-gold-soft' : 'text-muted'}`
  return (
    <div className="relative min-h-dvh">
      <StageBackdrop stage={game.rank?.rank?.n ?? 1} />
      {/* Боковое меню: планшет и ПК */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-white/5 bg-ink/85 p-4 backdrop-blur-md md:flex">
        <div className="mb-6 flex items-center gap-2 pt-2">
          <span className="text-gold-soft"><Seal size={30} /></span>
          <span className="gold-text font-serif text-[22px] leading-none">Династия</span>
        </div>
        <nav className="space-y-1">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end className={link(true)}>
              <span className="tab-icon inline-flex"><Icon name={t.icon} size={22} /></span>
              {t.label}
            </NavLink>
          ))}
        </nav>
        {p && <div className="mt-auto text-[12px] text-muted">{p.houseName}</div>}
      </aside>
      <div className="relative mx-auto min-h-dvh max-w-xl md:ml-56 md:max-w-none">
        <main key={loc.pathname} className={`animate-rise mx-auto max-w-xl px-4 pb-28 md:pb-10 ${loc.pathname === '/empire' ? 'md:max-w-6xl' : 'md:max-w-4xl'}`}>
          {p && <ResourceBar capital={p.capital} xp={p.xp} reputation={p.reputation} right={<VersionBadge />} />}
          {children}
        </main>
      </div>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/90 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-xl">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end className={link(false)}>
              <span className="tab-icon inline-flex"><Icon name={t.icon} size={22} /></span>
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
        12 недель: от Посыльного до Главы Дома. Учимся запускать рекламу в Instagram и Telegram. Титулы здесь не покупаются: только верным расчётом, рабочим креативом и реальным запуском.
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

