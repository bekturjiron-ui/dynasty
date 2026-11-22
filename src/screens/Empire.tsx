import { lazy, Suspense, useMemo, useState } from 'react'
import { content } from '../content'
import type { Building } from '../content/schema'
import { buyBuilding, weekStatus } from '../game/engine'
import type { Game } from '../game/useGame'
import { fmtNum } from '../lib/format'
import { Advisor, Bar, Button, Card, Icon, Label, Sparks } from '../components/ui'
import type { SceneSlot } from '../components/KingdomScene'

// three.js тяжёлый: грузим отдельным куском, только когда нужна модель
const ModelViewer = lazy(() => import('../components/ModelViewer'))
const KingdomScene = lazy(() => import('../components/KingdomScene'))

/** Размеры построек в диораме (мир) и положение на острове: карта 360×300 из empire.json → мир */
const SIZES: Record<string, number> = { lavka: 3.4, sklad: 3.9, kontora: 3.6, 'torgovy-dom': 4.3, birzha: 4.5, bank: 4.3, castle: 7.5 }
const toWorld = (x: number, y: number) => ({ x: (x - 180) / 30, z: (y - 150) / 30 })

type Status = 'owned' | 'ready' | 'capital' | 'rank'

export default function Empire({ game }: { game: Game }) {
  const p = game.player!
  const [sel, setSel] = useState<Building | null>(null)
  const [msg, setMsg] = useState('')
  const [burst, setBurst] = useState(0) // растёт при постройке: запускает вспышку и искры
  const [sceneFailed, setSceneFailed] = useState(false) // нет WebGL: остаётся плоская карта
  const { buildings } = content.empire
  const rankTitle = (n: number) => content.ranks.find((r) => r.n === n)?.title ?? `титул ${n}`

  // Замок не покупается: достраивается на высшем титуле
  const CASTLE: Building = useMemo(() => ({
    id: 'castle', title: 'Замок Дома', cost: 0, minRank: 7, x: 180, y: -80, kind: 'bank',
    text: 'Вершина пути. Когда всё выучено и построено, Дом становится замком. Достраивается на высшем титуле.',
    skills: [{ title: 'Весь путь: все недели плана', weeks: game.content.weeks.map((w) => w.key ?? w.n) }],
  }), [game.content.weeks])
  const status = (b: Building): Status =>
    b.id === 'castle' ? (p.rank >= b.minRank ? 'owned' : 'rank') : b.cost === 0 || game.buildings.has(b.id) ? 'owned' : p.rank < b.minRank ? 'rank' : p.capital < b.cost ? 'capital' : 'ready'

  const owned = buildings.filter((b) => status(b) === 'owned').length
  /** Прогресс навыка: пройденные уроки его недель / все уроки этих недель */
  const skillProgress = (weeks: number[]) => {
    let done = 0, total = 0
    for (const k of weeks) {
      const w = game.content.weeks.find((x) => (x.key ?? x.n) === k)
      if (!w) continue
      const s = weekStatus(w, game.content, game.st)
      done += s.lessonsDone; total += s.lessonsTotal
    }
    return { done, total, ratio: total ? done / total : 0 }
  }

  const slots: SceneSlot[] = useMemo(() => [...buildings, CASTLE].map((b) => {
    const st = status(b)
    const w = toWorld(b.x, b.y)
    const label = st === 'owned' ? b.title : st === 'ready' ? `Построить · ${fmtNum(b.cost)} ₸` : st === 'capital' ? `${b.title} · ${fmtNum(b.cost)} ₸` : `🔒 ${b.title}`
    return { id: b.id, model: b.id, x: w.x, z: b.id === 'castle' ? -7.8 : w.z, size: SIZES[b.id] ?? 2.5, state: st, label }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [buildings, CASTLE, p.rank, p.capital, game.buildings])
  const pick = (id: string) => { const b = id === 'castle' ? CASTLE : buildings.find((x) => x.id === id); if (b) { setSel(b); setMsg('') } }

  async function buy(b: Building) {
    const r = await buyBuilding(content, b.id)
    if (r.ok) { setMsg(`${b.title} построен. Казна: ${fmtNum(p.capital - b.cost)} ₸.`); setBurst((n) => n + 1) }
    else setMsg(r.reason === 'capital' ? 'Не хватает Капитала.' : r.reason === 'rank' ? `Нужен титул «${rankTitle(b.minRank)}».` : 'Уже построено.')
  }

  return (
    <div className="space-y-3">
      {/* Империя — это картинка: сцена на весь экран, без графиков и таблиц */}
      <div className="relative overflow-hidden rounded-3xl border border-gold/40 shadow-[0_0_40px_-10px_rgba(201,162,39,0.5)]">
        {!sceneFailed ? (
          <Suspense fallback={<div className="h-[72dvh] min-h-[460px] md:h-[calc(100dvh-8rem)] md:min-h-[560px]" />}>
            <KingdomScene slots={slots} onSelect={pick} onFail={() => setSceneFailed(true)} className="h-[72dvh] min-h-[460px] md:h-[calc(100dvh-8rem)] md:min-h-[560px]" />
          </Suspense>
        ) : (
          <Card className="p-2">
            <svg viewBox="0 0 360 300" className="w-full" role="img" aria-label="Карта построек Дома">
              <defs>
                <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#2c2c31" /></pattern>
                <radialGradient id="glow"><stop offset="0%" stopColor="#c9a227" stopOpacity="0.35" /><stop offset="100%" stopColor="#c9a227" stopOpacity="0" /></radialGradient>
              </defs>
              <rect width="360" height="300" fill="url(#dots)" />
              {/* дороги: от лавки к банку */}
              {buildings.slice(1).map((b, i) => {
                const a = buildings[i]
                const on = status(a) === 'owned' && status(b) === 'owned'
                return <line key={b.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? '#c9a227' : '#2c2c31'} strokeWidth={on ? 2 : 1.5} strokeDasharray={on ? undefined : '4 5'} />
              })}
              {buildings.map((b) => {
                const s = status(b)
                return (
                  <g key={b.id} transform={`translate(${b.x} ${b.y})`} onClick={() => { setSel(b); setMsg('') }} className="cursor-pointer" role="button" aria-label={`${b.title}: ${s === 'owned' ? 'построено' : s === 'ready' ? 'можно построить' : 'закрыто'}`}>
                    {s === 'ready' && <circle r="36" fill="url(#glow)"><animate attributeName="r" values="30;38;30" dur="2.4s" repeatCount="indefinite" /></circle>}
                    <BuildingShape kind={b.kind} status={s} />
                    <text y="34" textAnchor="middle" fontSize="10.5" fill={s === 'owned' ? '#e3c766' : s === 'ready' ? '#ede7d9' : '#6f6a60'}>{b.title}</text>
                    {s === 'rank' && <g transform="translate(14 -26)"><circle r="8" fill="#17171a" stroke="#6f6a60" /><path d="M-3 0v-2a3 3 0 0 1 6 0v2M-4 0h8v5h-8z" fill="none" stroke="#9a9486" strokeWidth="1.2" /></g>}
                  </g>
                )
              })}
            </svg>
            <p className="px-2 pb-1 text-[12px] text-muted">Тап по постройке — подробности. Строится за Капитал, но только с нужным титулом.</p>
          </Card>
        )}
        <div className="pointer-events-none absolute left-4 top-4 md:left-6 md:top-5">
          <div className="hero-text font-serif text-[26px] leading-none">Империя</div>
          <div className="hero-text mt-1 text-[13px] text-parch/90">построек {owned} из {buildings.length}</div>
        </div>
        <p className="hero-text pointer-events-none absolute inset-x-0 bottom-3 px-4 text-center text-[12px] text-parch/80">Тяни — повернуть · щипок — приблизить</p>
      </div>
      {msg && <Advisor tone="gain">{msg}</Advisor>}

      {sel && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setSel(null)}>
          <div className="pb-safe animate-rise max-h-[92dvh] w-full overflow-y-auto surface rounded-t-3xl border-t border-gold/40 px-5 pt-3 md:mx-auto md:max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
            <div className="relative">
              <Suspense fallback={<div className="h-56" />}><ModelViewer name={sel.id} dim={status(sel) !== 'owned'} className="h-56 md:h-72" /></Suspense>
              {burst > 0 && status(sel) === 'owned' && <div key={burst} className="unlock-flash" aria-hidden />}
              <Sparks burst={burst} big />
            </div>
            <div className="flex items-center gap-3">
              <div>
                <div className="font-serif text-[22px]">{sel.title}</div>
                <div className="text-[13px] text-muted">{sel.id === 'castle' ? `Достраивается на титуле «${rankTitle(sel.minRank)}»` : sel.cost ? `${fmtNum(sel.cost)} ₸ Капитала · титул «${rankTitle(sel.minRank)}»` : 'Есть с основания Дома'}</div>
              </div>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed">{sel.text}</p>
            <div className="mt-4">
              <Label>Связанные навыки</Label>
              <div className="mt-2 space-y-2">
                {sel.skills.map((sk) => {
                  const pr = skillProgress(sk.weeks)
                  const full = pr.total > 0 && pr.done === pr.total
                  return (
                    <div key={sk.title} className="rounded-xl bg-white/[0.05] px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-[14px]">
                        <span className={full ? 'text-gain' : ''}>{sk.title}</span>
                        <span className="flex shrink-0 items-center gap-1 text-[12px] text-muted">{full && <span className="animate-check text-gain"><Icon name="check" size={16} /></span>}{pr.total ? `${pr.done}/${pr.total}` : 'готовится'}</span>
                      </div>
                      <Bar value={pr.ratio} className="mt-1.5 !h-1.5" />
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {(() => {
                const s = status(sel)
                if (s === 'owned') return <p className="flex items-center gap-2 text-gain"><span className={burst > 0 ? 'animate-check' : ''}><Icon name="check" size={18} /></span>Построено</p>
                if (s === 'rank') return <p className="text-[14px] text-muted">Нужен титул «{rankTitle(sel.minRank)}». Титулы дают реальные контракты, не Капитал.</p>
                if (s === 'capital') return <p className="text-[14px] text-muted">Не хватает {fmtNum(sel.cost - p.capital)} ₸ Капитала. Урок без подсказок — +100, босс — +300, контракт — +500.</p>
                return <Button full onClick={() => buy(sel)}>Построить за {fmtNum(sel.cost)} ₸</Button>
              })()}
              <Button variant="quiet" full onClick={() => setSel(null)}>Закрыть</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Силуэты построек (центр в 0,0, размер ~50). */
function BuildingShape({ kind, status }: { kind: Building['kind']; status: Status }) {
  const fill = status === 'owned' ? '#c9a227' : status === 'ready' ? '#2a2412' : '#1f1f23'
  const stroke = status === 'owned' ? '#f0d77a' : status === 'ready' ? '#c9a227' : '#3a3a40'
  const win = status === 'owned' ? '#0e0e10' : status === 'ready' ? '#c9a227' : '#2c2c31'
  const p = { fill, stroke, strokeWidth: 1.5, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'shop':
      return <g><path d="M-16 18V-2h32v20z" {...p} /><path d="M-20 -2 -14 -14h28l6 12z" {...p} /><rect x="-5" y="6" width="10" height="12" fill={win} /></g>
    case 'warehouse':
      return <g><path d="M-22 18V-4l22-12 22 12v22z" {...p} /><rect x="-9" y="2" width="18" height="16" fill={win} /><path d="M-9 8h18M-9 13h18" stroke={fill} strokeWidth="1.5" /></g>
    case 'office':
      return <g><rect x="-14" y="-18" width="28" height="36" {...p} />{[-12, -3, 6].map((y) => [-8, 3].map((x) => <rect key={`${x}${y}`} x={x} y={y} width="5" height="5" fill={win} />))}</g>
    case 'house':
      return <g><path d="M-22 18V-6h44v24z" {...p} /><path d="M-25 -6 0 -22l25 16z" {...p} />{[-15, -5, 5].map((x) => <rect key={x} x={x} y="0" width="6" height="8" fill={win} />)}<rect x="12" y="4" width="6" height="14" fill={win} /></g>
    case 'exchange':
      return <g><path d="M-24 18h48v-4h-48zM-22 -8h44l-22-12z" {...p} />{[-17, -6, 5, 16].map((x) => <rect key={x} x={x - 2.5} y="-8" width="5" height="22" {...p} />)}</g>
    case 'bank':
      return <g><path d="M-26 18h52v-5h-52zM-23 -6h46v-4h-46z" {...p} /><path d="M-12 -10a12 12 0 0 1 24 0z" {...p} /><path d="M0 -22v-6" stroke={stroke} strokeWidth="1.5" />{[-18, -9, 0, 9, 18].map((x) => <rect key={x} x={x - 2} y="-6" width="4" height="19" {...p} />)}</g>
  }
}
