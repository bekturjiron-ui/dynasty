import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { content } from '../../content'
import type { WeeklyReport } from '../../db'
import { diagnose, metrics } from '../../game/diagnose'
import { REPORT_REWARD, saveWeeklyReport } from '../../game/engine'
import type { Game } from '../../game/useGame'
import { fmtNum, fmtTg, parseUserNumber } from '../../lib/format'
import { TermText } from '../../components/Glossary'
import { Advisor, Button, Card, Label } from '../../components/ui'

const tip = { contentStyle: { background: '#1f1f23', border: '1px solid #2c2c31', borderRadius: 12, color: '#ede7d9', fontSize: 13 }, labelStyle: { color: '#9a9486' } }
const axis = { tick: { fill: '#9a9486', fontSize: 11 }, axisLine: false, tickLine: false } as const

const FIELDS = [
  ['spend', 'Расход', '₸'],
  ['impressions', 'Показы', 'шт'],
  ['reach', 'Охват', 'чел'],
  ['clicks', 'Клики', 'шт'],
  ['leads', 'Заявки', 'шт'],
  ['sales', 'Продажи', 'шт'],
  ['revenue', 'Выручка', '₸'],
] as const
type NumKey = (typeof FIELDS)[number][0]
type Draft = Record<NumKey, string> & { note: string }
const empty: Draft = { spend: '', impressions: '', reach: '', clicks: '', leads: '', sales: '', revenue: '', note: '' }

const pct = (v?: number) => (v === undefined ? '—' : `${fmtNum(Math.round(v * 1000) / 10)}%`)
const tg = (v?: number) => (v === undefined ? '—' : fmtTg(Math.round(v)))

export function WeekReport({ game }: { game: Game }) {
  const [week, setWeek] = useState(game.weekNow)
  const [d, setD] = useState<Draft>(empty)
  const [msg, setMsg] = useState('')
  const existing = game.reports.find((r) => r.week === week)

  useEffect(() => {
    const r = game.reports.find((x) => x.week === week)
    setD(r ? { spend: String(r.spend), impressions: String(r.impressions), reach: String(r.reach), clicks: String(r.clicks), leads: String(r.leads), sales: String(r.sales), revenue: String(r.revenue), note: r.note ?? '' } : empty)
    setMsg('')
  }, [week]) // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = Object.fromEntries(FIELDS.map(([k]) => [k, parseUserNumber(d[k] || '0')])) as Record<NumKey, number | null>
  const numsOk = FIELDS.every(([k]) => parsed[k] !== null && parsed[k]! >= 0) && d.spend.trim() !== ''
  const p = parsed as Record<NumKey, number>
  // Цифры, которые не могут быть правдой: Совет такой отчёт не принимает, а советник говорит, что сверить
  const blockers = !numsOk ? [] : [
    p.spend <= 0 && 'Расход 0 ₸: кампания ещё не крутилась. Сдай отчёт, когда будут показы.',
    p.impressions <= 0 && 'Показов нет — разбирать пока нечего.',
    p.clicks > p.impressions && 'Кликов больше, чем показов. Сверь колонки в кабинете: возможно, взяты клики по всем ссылкам за другой период.',
    p.reach > p.impressions && 'Охват больше показов. Охват — уникальные люди, их не бывает больше показов.',
    p.sales > p.leads && p.leads > 0 && 'Продаж больше, чем заявок. Проверь, не попали ли в продажи клиенты не из рекламы.',
  ].filter((x): x is string => !!x)
  const warns = numsOk && p.leads > p.clicks ? ['Заявок больше кликов: так бывает с лид-формой или звонками, но проверь, что заявки только из этой кампании.'] : []
  const valid = numsOk && blockers.length === 0
  const nums = valid ? p : null
  const m = nums ? metrics(nums) : null
  const verdict = nums && nums.impressions > 0 ? diagnose(nums, game.settings.project) : null

  async function save() {
    if (!nums) return
    const r: WeeklyReport = { week, ...nums, note: d.note.trim() || undefined }
    const g = await saveWeeklyReport(content, r)
    setMsg(g.xp ? `Отчёт недели ${week} принят. +${g.xp} XP.` : `Цифры недели ${week} обновлены.`)
  }

  const chart = game.reports.map((r) => ({ label: `Н${r.week}`, spend: r.spend, revenue: r.revenue }))
  const rows: [string, string][] = m ? [['CPM', tg(m.cpm)], ['CTR', pct(m.ctr)], ['CPC', tg(m.cpc)], ['Частота', m.frequency === undefined ? '—' : fmtNum(Math.round(m.frequency * 10) / 10)], ['Клик → заявка', pct(m.cr)], ['CPL', tg(m.cpl)], ['Заявка → продажа', pct(m.leadToSale)], ['CAC', tg(m.cac)], ['ROAS', m.roas === undefined ? '—' : `${fmtNum(Math.round(m.roas * 100))}%`]] : []

  return (
    <>
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label>Кампания за неделю</Label>
          <select value={week} onChange={(e) => setWeek(Number(e.target.value))} className="rounded-lg border border-line bg-ink px-2 py-1 text-[14px] text-parch">
            {Array.from({ length: game.weekNow }, (_, i) => game.weekNow - i).map((w) => <option key={w} value={w}>Неделя {w}{game.reports.some((r) => r.week === w) ? ' ✓' : ''}</option>)}
          </select>
        </div>
        <p className="text-[13px] text-muted"><TermText text="Цифры из Ads Manager или Telegram Ads, заявки и продажи из своей таблицы." /> {existing ? 'Отчёт уже сдан, можно поправить.' : `Первый отчёт недели: +${REPORT_REWARD.xp} XP.`}</p>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map(([k, label, suffix]) => (
            <label key={k} className="block min-w-0">
              <span className="text-[13px] text-muted">{label}, {suffix}</span>
              <input inputMode="decimal" value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} className="mt-1 min-h-12 w-full rounded-xl border border-line bg-ink px-3 tabular-nums outline-none focus:border-gold" />
            </label>
          ))}
        </div>
        <label className="block">
          <span className="text-[13px] text-muted">Что меняли на этой неделе</span>
          <textarea value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-line bg-ink px-4 py-3 text-[16px] outline-none focus:border-gold" />
        </label>
        {[...blockers, ...warns].map((t) => <p key={t} className="text-[13px] text-muted">Советник: {t}</p>)}
        <Button full disabled={!valid} onClick={save}>{existing ? 'Обновить отчёт' : 'Сдать отчёт Совету'}</Button>
      </Card>
      {msg && <Advisor tone="gain">{msg}</Advisor>}

      {m && verdict && (
        <Card className="space-y-3">
          <Label>Доклад советника</Label>
          <Advisor tone={verdict.tone}><b><TermText text={verdict.title} />.</b> <TermText text={verdict.text} /></Advisor>
          <div className="grid grid-cols-3 gap-2">
            {rows.map(([k, v]) => (
              <div key={k} className="min-w-0 rounded-xl bg-white/[0.04] px-2 py-2">
                <div className="truncate text-[11px] text-muted"><TermText text={k} /></div>
                <div className="truncate text-[14px] font-semibold tabular-nums text-parch">{v}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {chart.length > 0 && (
        <Card className="space-y-3">
          <Label>Расход и выручка по неделям</Label>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="#2c2c31" vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} width={52} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}к`} />
                <Tooltip {...tip} formatter={(v, name) => [fmtTg(Number(v)), name === 'spend' ? 'Расход' : 'Выручка']} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="spend" fill="#d88a6e" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="revenue" fill="#c9a227" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-[12px] text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[#d88a6e]" />Расход</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-gold" />Выручка</span>
          </div>
        </Card>
      )}
    </>
  )
}
