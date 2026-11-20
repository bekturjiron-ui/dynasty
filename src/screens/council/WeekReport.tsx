import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { content } from '../../content'
import type { WeeklyReport } from '../../db'
import { REPORT_REWARD, saveWeeklyReport } from '../../game/engine'
import { byWeek, matchProduct } from '../../game/importKaspi'
import type { Game } from '../../game/useGame'
import { addDays } from '../../lib/dates'
import { fmtNum, fmtPct, fmtTg, parseUserNumber } from '../../lib/format'
import { Advisor, Button, Card, Label } from '../../components/ui'

const tip = { contentStyle: { background: '#1f1f23', border: '1px solid #2c2c31', borderRadius: 12, color: '#ede7d9', fontSize: 13 }, labelStyle: { color: '#9a9486' } }
const axis = { tick: { fill: '#9a9486', fontSize: 11 }, axisLine: false, tickLine: false } as const

type Draft = { revenue: string; orders: string; reviews: string; adSpend: string; margin: string; note: string }
const empty: Draft = { revenue: '', orders: '', reviews: '', adSpend: '', margin: '', note: '' }

export function WeekReport({ game }: { game: Game }) {
  const p = game.player!
  const [week, setWeek] = useState(game.weekNow)
  const [d, setD] = useState<Draft>(empty)
  const [msg, setMsg] = useState('')
  const existing = game.reports.find((r) => r.week === week)
  const prev = [...game.reports].filter((r) => r.week < week).pop()

  useEffect(() => {
    const r = game.reports.find((x) => x.week === week)
    setD(r ? { revenue: String(r.revenue), orders: String(r.orders), reviews: String(r.reviews), adSpend: String(r.adSpend), margin: r.margin !== undefined ? String(Math.round(r.margin * 1000) / 10) : '', note: r.note ?? '' } : empty)
    setMsg('')
  }, [week]) // eslint-disable-line react-hooks/exhaustive-deps

  // Цифры недели плана из архива Kaspi, если архив её покрывает
  const fromArchive = useMemo(() => {
    const from = addDays(p.startedAt, 7 * (week - 1 + (p.planOffsetWeeks ?? 0)))
    const to = addDays(from, 6)
    const rows = game.kaspiRows.filter((r) => r.date >= from && r.date <= to)
    if (!rows.length) return null
    const s = game.settings
    const w = byWeek(rows, (n) => { const pr = matchProduct(n, content.products); return pr ? pr.cost + pr.inbound : undefined }, { fee: s.kaspiFeePct / 100, tax: s.taxPct / 100, pack: (s.packPct ?? 1) / 100 })
    const revenue = w.reduce((a, x) => a + x.revenue, 0)
    const orders = w.reduce((a, x) => a + x.orders, 0)
    const m = w.filter((x) => x.margin !== undefined)
    return { revenue, orders, margin: m.length ? m.reduce((a, x) => a + (x.margin ?? 0) * x.revenue, 0) / m.reduce((a, x) => a + x.revenue, 0) : undefined }
  }, [game.kaspiRows, game.settings, p.startedAt, p.planOffsetWeeks, week])

  const n = { revenue: parseUserNumber(d.revenue), orders: parseUserNumber(d.orders), reviews: parseUserNumber(d.reviews || '0'), adSpend: parseUserNumber(d.adSpend || '0'), margin: d.margin.trim() ? parseUserNumber(d.margin) : undefined }
  const valid = n.revenue !== null && n.orders !== null && n.reviews !== null && n.adSpend !== null && n.margin !== null

  async function save() {
    if (!valid) return
    const r: WeeklyReport = { week, revenue: n.revenue!, orders: n.orders!, reviews: n.reviews!, adSpend: n.adSpend!, margin: n.margin !== undefined && n.margin !== null ? n.margin / 100 : undefined, note: d.note.trim() || undefined }
    const g = await saveWeeklyReport(content, r)
    setMsg(g.xp ? `Отчёт недели ${week} принят. +${g.xp} XP.` : `Цифры недели ${week} обновлены.`)
  }

  const delta = (cur: number | null | undefined, old: number | undefined) => {
    if (cur === null || cur === undefined || old === undefined || old === 0) return null
    const k = (cur - old) / Math.abs(old)
    return <span className={k >= 0 ? 'text-gain' : 'text-loss'}>{k >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(k))}</span>
  }
  const field = (key: keyof Draft, label: string, suffix: string, old?: number) => (
    <label className="block">
      <span className="flex justify-between text-[13px] text-muted"><span>{label}</span>{delta(n[key as keyof typeof n] as number, old)}</span>
      <div className="mt-1 flex items-center gap-2">
        <input inputMode="decimal" value={d[key]} onChange={(e) => setD({ ...d, [key]: e.target.value })} className="min-h-12 w-full rounded-xl border border-line bg-ink px-4 tabular-nums outline-none focus:border-gold" />
        <span className="w-6 text-muted">{suffix}</span>
      </div>
    </label>
  )

  const chart = game.reports.map((r) => ({ label: `Н${r.week}`, revenue: r.revenue, margin: r.margin !== undefined ? Math.round(r.margin * 1000) / 10 : null, drr: r.revenue ? Math.round((r.adSpend / r.revenue) * 1000) / 10 : null }))

  return (
    <>
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Цифры Novelia за неделю</Label>
          <select value={week} onChange={(e) => setWeek(Number(e.target.value))} className="rounded-lg border border-line bg-ink px-2 py-1 text-[14px] text-parch">
            {Array.from({ length: game.weekNow }, (_, i) => game.weekNow - i).map((w) => <option key={w} value={w}>Неделя {w}{game.reports.some((r) => r.week === w) ? ' ✓' : ''}</option>)}
          </select>
        </div>
        <p className="text-[13px] text-muted">Раз в неделю, лучше в воскресенье. Цифры — из кабинета Kaspi. {existing ? 'Отчёт уже сдан — можно поправить.' : `Первый отчёт недели: +${REPORT_REWARD.xp} XP.`}</p>
        {fromArchive && !existing && (
          <Button variant="ghost" full onClick={() => setD({ ...d, revenue: String(Math.round(fromArchive.revenue)), orders: String(fromArchive.orders), margin: fromArchive.margin !== undefined ? String(Math.round(fromArchive.margin * 1000) / 10) : d.margin })}>
            Подставить из архива Kaspi: {fmtTg(fromArchive.revenue)}, {fromArchive.orders} зак.
          </Button>
        )}
        {field('revenue', 'Выручка', '₸', prev?.revenue)}
        {field('orders', 'Заказов', 'шт', prev?.orders)}
        {field('reviews', 'Новых отзывов', 'шт', prev?.reviews)}
        {field('adSpend', 'Расход на рекламу', '₸', prev?.adSpend)}
        {field('margin', 'Маржа (если посчитал)', '%', prev?.margin !== undefined ? prev.margin * 100 : undefined)}
        <label className="block">
          <span className="text-[13px] text-muted">Что важного случилось</span>
          <textarea value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-line bg-ink px-4 py-3 text-[16px] outline-none focus:border-gold" />
        </label>
        {prev && <p className="text-[12px] text-muted">▲▼ — сравнение с неделей {prev.week}.</p>}
        <Button full disabled={!valid} onClick={save}>{existing ? 'Обновить отчёт' : 'Сдать отчёт Совету'}</Button>
      </Card>
      {msg && <Advisor tone="gain">{msg}</Advisor>}

      {chart.length > 0 && (
        <Card className="space-y-3">
          <Label>Выручка по неделям плана</Label>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="#2c2c31" vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} width={52} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}к`} />
                <Tooltip {...tip} formatter={(v) => [fmtTg(Number(v)), 'Выручка']} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="revenue" fill="#c9a227" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {chart.some((c) => c.margin !== null || c.drr !== null) && (
            <>
              <Label>Маржа и ДРР, %</Label>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#2c2c31" vertical={false} />
                    <XAxis dataKey="label" {...axis} />
                    <YAxis {...axis} width={40} />
                    <Tooltip {...tip} formatter={(v, name) => [`${fmtNum(Number(v))}%`, name === 'margin' ? 'Маржа' : 'ДРР']} />
                    <Line dataKey="margin" stroke="#86b77e" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                    <Line dataKey="drr" stroke="#d88a6e" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 text-[12px] text-muted">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-gain" />Маржа</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-loss" />ДРР — реклама / выручка</span>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  )
}
