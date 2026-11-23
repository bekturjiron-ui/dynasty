import { useState } from 'react'
import { db, type ProjectBrief } from '../../db'
import { briefEconomy } from '../../game/diagnose'
import type { Game } from '../../game/useGame'
import { fmtTg, parseUserNumber } from '../../lib/format'
import { Button, Card, Label } from '../../components/ui'

const NUMS = [
  ['avgCheck', 'Средний чек', '₸'],
  ['marginPct', 'Маржа', '%'],
  ['clickToLeadPct', 'Клик → заявка', '%'],
  ['leadToSalePct', 'Заявка → продажа', '%'],
  ['targetCacPct', 'Цена клиента от прибыли', '%'],
] as const
type NumKey = (typeof NUMS)[number][0]

/** Бриф проекта: из него считаются потолки цены клиента, заявки и клика. */
export function ProjectBriefCard({ game }: { game: Game }) {
  const s = game.settings
  const [name, setName] = useState(s.project.name)
  const [niche, setNiche] = useState(s.project.niche)
  const [vals, setVals] = useState<Record<NumKey, string>>(() => Object.fromEntries(NUMS.map(([k]) => [k, String(s.project[k])])) as Record<NumKey, string>)
  const [saved, setSaved] = useState(false)

  const parsed = Object.fromEntries(NUMS.map(([k]) => [k, parseUserNumber(vals[k])])) as Record<NumKey, number | null>
  const valid = parsed.avgCheck !== null && parsed.avgCheck > 0 && NUMS.slice(1).every(([k]) => parsed[k] !== null && parsed[k]! > 0 && parsed[k]! <= 100)
  const brief: ProjectBrief | null = valid ? { name: name.trim() || 'Мой проект', niche: niche.trim(), ...(parsed as Record<NumKey, number>) } : null
  const e = brief ? briefEconomy(brief) : null

  async function save() {
    if (!brief) return
    await db.settings.put({ ...s, project: brief })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }
  const text = 'min-h-12 w-full rounded-xl border border-line bg-ink px-3 outline-none focus:border-gold'

  return (
    <Card className="space-y-3">
      <Label>Бриф проекта</Label>
      <p className="text-[13px] text-muted">Что продвигаем и сколько можно платить за клиента. Пока нет своих цифр, оставь учебные.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block min-w-0"><span className="text-[13px] text-muted">Проект</span><input value={name} onChange={(x) => setName(x.target.value)} className={`mt-1 ${text}`} /></label>
        <label className="block min-w-0"><span className="text-[13px] text-muted">Ниша</span><input value={niche} onChange={(x) => setNiche(x.target.value)} className={`mt-1 ${text}`} /></label>
        {NUMS.map(([k, label, suffix]) => (
          <label key={k} className="block min-w-0">
            <span className="text-[13px] text-muted">{label}, {suffix}</span>
            <input inputMode="decimal" value={vals[k]} onChange={(x) => setVals({ ...vals, [k]: x.target.value })} className={`mt-1 tabular-nums ${text}`} />
          </label>
        ))}
      </div>
      {e && (
        <div className="divide-y divide-line rounded-xl bg-white/[0.04] px-3 text-[14px]">
          {([['Прибыль с продажи', e.profit], ['Клиент: цель / потолок', null], ['Заявка: цель / потолок', null], ['Клик: цель / потолок', null], ['Минимальный тест', e.testBudget]] as const).map(([l, v], i) => (
            <div key={l} className="flex items-center justify-between gap-3 py-2">
              <span className="text-muted">{l}</span>
              <span className="tabular-nums text-parch">{v !== null ? fmtTg(Math.round(v)) : i === 1 ? `${fmtTg(Math.round(e.targetCac))} / ${fmtTg(Math.round(e.maxCac))}` : i === 2 ? `${fmtTg(Math.round(e.targetCpl))} / ${fmtTg(Math.round(e.maxCpl))}` : `${fmtTg(Math.round(e.targetCpc))} / ${fmtTg(Math.round(e.maxCpc))}`}</span>
            </div>
          ))}
        </div>
      )}
      <Button full disabled={!valid} onClick={save}>{saved ? 'Сохранено' : 'Сохранить бриф'}</Button>
    </Card>
  )
}
