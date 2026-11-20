import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { content } from '../content'
import type { Building } from '../content/schema'
import { buyBuilding } from '../game/engine'
import { duelSeries, weekOverWeek } from '../game/rival'
import type { Game } from '../game/useGame'
import { dayKey } from '../lib/dates'
import { fmtNum } from '../lib/format'
import { Advisor, Button, Card, Icon, Label, Title } from '../components/ui'

type Status = 'owned' | 'ready' | 'capital' | 'rank'

export default function Empire({ game }: { game: Game }) {
  const p = game.player!
  const [sel, setSel] = useState<Building | null>(null)
  const [msg, setMsg] = useState('')
  const today = dayKey()
  const { buildings, rival } = content.empire
  const rankTitle = (n: number) => content.ranks.find((r) => r.n === n)?.title ?? `титул ${n}`

  const status = (b: Building): Status =>
    b.cost === 0 || game.buildings.has(b.id) ? 'owned' : p.rank < b.minRank ? 'rank' : p.capital < b.cost ? 'capital' : 'ready'

  const series = useMemo(() => duelSeries(game.content, p.startedAt, today, game.activity, p.planOffsetWeeks ?? 0), [game.content, p.startedAt, p.planOffsetWeeks, game.activity, today])
  const last = series[series.length - 1]
  const lead = last.me - last.rival
  const wow = weekOverWeek(game.activity, today)
  const news = rival.news.filter((x) => x.week <= game.weekNow).slice(-2).reverse()
  const owned = buildings.filter((b) => status(b) === 'owned').length

  async function buy(b: Building) {
    const r = await buyBuilding(content, b.id)
    if (r.ok) { setMsg(`${b.title} построен. Казна: ${fmtNum(p.capital - b.cost)} ₸.`); setSel(null) }
    else setMsg(r.reason === 'capital' ? 'Не хватает Капитала.' : r.reason === 'rank' ? `Нужен титул «${rankTitle(b.minRank)}».` : 'Уже построено.')
  }

  return (
    <div className="space-y-5">
      <div className="pt-2">
        <Title>Империя</Title>
        <p className="mt-1 text-[14px] text-muted">{p.houseName} · построек {owned} из {buildings.length} · казна <b className="text-gold">{fmtNum(p.capital)} ₸</b></p>
      </div>

      {/* Карта построек */}
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
      {msg && <Advisor tone="gain">{msg}</Advisor>}

      {/* Соперник */}
      <Card className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <Label>Ты против «{rival.name}»</Label>
          <span className={`text-[13px] font-semibold ${lead >= 0 ? 'text-gain' : 'text-loss'}`}>{lead >= 0 ? `впереди на ${fmtNum(lead)} XP` : `отстаёшь на ${fmtNum(-lead)} XP`}</span>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#2c2c31" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#9a9486', fontSize: 11 }} axisLine={{ stroke: '#2c2c31' }} tickLine={false} />
              <YAxis tick={{ fill: '#9a9486', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                contentStyle={{ background: '#1f1f23', border: '1px solid #2c2c31', borderRadius: 12, color: '#ede7d9', fontSize: 13 }}
                labelStyle={{ color: '#9a9486' }}
                formatter={(v, name) => [`${fmtNum(Number(v))} XP`, name === 'me' ? p.houseName : rival.name]}
              />
              <Line type="monotone" dataKey="rival" stroke="#6f6a60" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="me" stroke="#c9a227" strokeWidth={2.5} dot={{ r: 3, fill: '#c9a227' }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 text-[12px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-gold" />{p.houseName}</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-[#6f6a60]" />{rival.name}</span>
        </div>
        <p className="text-[13px] leading-relaxed text-muted">{rival.motto}</p>
        {news.map((x) => (
          <p key={x.week} className="border-l-2 border-gold/40 pl-3 text-[14px] leading-relaxed"><span className="text-muted">Неделя {x.week}. </span>{x.text}</p>
        ))}
      </Card>

      {/* Сравнение с собой */}
      <Card>
        <Label>Ты против себя неделю назад</Label>
        <div className="mt-2 flex items-end gap-6">
          <div><div className="text-[24px] font-semibold text-gold">{fmtNum(wow.thisWeek)}</div><div className="text-[12px] text-muted">XP за 7 дней</div></div>
          <div><div className="text-[24px] font-semibold text-parch/70">{fmtNum(wow.lastWeek)}</div><div className="text-[12px] text-muted">за 7 дней до этого</div></div>
        </div>
        <p className="mt-2 text-[13px] text-muted">
          {wow.thisWeek > wow.lastWeek ? 'Темп выше, чем неделю назад.' : wow.thisWeek === wow.lastWeek ? 'Темп ровный.' : 'Темп ниже прошлой недели — один урок сегодня это исправит.'}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {[
          { k: 'Капитал', v: `${fmtNum(p.capital)} ₸`, d: 'за верные расчёты' },
          { k: 'Влияние', v: fmtNum(p.influence), d: 'переговоры, отзывы, делегирование' },
          { k: 'Репутация', v: `${p.reputation}/100`, d: 'лояльность партнёров' },
          { k: 'Опыт', v: `${fmtNum(p.xp)} XP`, d: 'только за проверяемые результаты' },
        ].map((r) => (
          <Card key={r.k}>
            <Label>{r.k}</Label>
            <div className="mt-1 text-[20px] font-semibold text-gold">{r.v}</div>
            <div className="mt-1 text-[12px] leading-snug text-muted">{r.d}</div>
          </Card>
        ))}
      </div>

      {sel && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={() => setSel(null)}>
          <div className="pb-safe animate-rise w-full rounded-t-3xl border-t border-gold/40 bg-panel px-5 pt-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <div className="flex items-center gap-3">
              <svg viewBox="-30 -30 60 60" className="h-14 w-14"><BuildingShape kind={sel.kind} status={status(sel)} /></svg>
              <div>
                <div className="font-serif text-[22px]">{sel.title}</div>
                <div className="text-[13px] text-muted">{sel.cost ? `${fmtNum(sel.cost)} ₸ Капитала · титул «${rankTitle(sel.minRank)}»` : 'Есть с основания Дома'}</div>
              </div>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed">{sel.text}</p>
            <div className="mt-4 space-y-2">
              {(() => {
                const s = status(sel)
                if (s === 'owned') return <p className="flex items-center gap-2 text-gain"><Icon name="check" size={18} />Построено</p>
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
