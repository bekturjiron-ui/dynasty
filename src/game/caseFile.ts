// Кейс проекта: пруфы и цифры 12 шагов «Проекта Дома» в одном документе. Чистые функции, без обращения к базе.
import type { Week } from '../content/schema'
import type { ContractResult, ProjectBrief, WeeklyReport } from '../db'
import { fmtNum, fmtPct, fmtTg } from '../lib/format'
import { briefEconomy, metrics, type CampaignNumbers } from './diagnose'

export type CaseStep = {
  key: number
  n: number
  title: string
  task: string
  deliverable?: string
  proof: 'photo' | 'number' | 'checkbox'
  numberLabel?: string
  done: boolean
  at?: string
  value?: number
  hasPhoto: boolean
  note: string
}

export type CaseModel = {
  project: ProjectBrief
  steps: CaseStep[]
  doneCount: number
  economy: ReturnType<typeof briefEconomy>
  results?: { reports: number; totals: CampaignNumbers; m: ReturnType<typeof metrics>; romi?: number }
}

export function buildCase(weeks: Week[], contracts: Map<number, ContractResult>, project: ProjectBrief, reports: WeeklyReport[], notes: Record<number, string> = {}): CaseModel {
  const steps: CaseStep[] = weeks
    .filter((w) => w.contract.title)
    .map((w) => {
      const key = w.key ?? w.n
      const r = contracts.get(key)
      return {
        key,
        n: w.n,
        title: w.contract.title!,
        task: w.contract.text,
        deliverable: w.contract.deliverable,
        proof: w.contract.proof,
        numberLabel: w.contract.numberLabel,
        done: !!r,
        at: r?.at,
        value: r?.value,
        hasPhoto: !!r?.photo,
        note: notes[key] ?? '',
      }
    })

  let results: CaseModel['results']
  if (reports.length > 0) {
    // Охват не складывается между неделями (люди повторяются), поэтому в итоге он не участвует
    const totals: CampaignNumbers = reports.reduce(
      (a, r) => ({ spend: a.spend + r.spend, impressions: a.impressions + r.impressions, reach: 0, clicks: a.clicks + r.clicks, leads: a.leads + r.leads, sales: a.sales + r.sales, revenue: a.revenue + r.revenue }),
      { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, sales: 0, revenue: 0 },
    )
    const romi = totals.spend > 0 ? (totals.revenue * (project.marginPct / 100) - totals.spend) / totals.spend : undefined
    results = { reports: reports.length, totals, m: metrics(totals), romi }
  }

  return { project, steps, doneCount: steps.filter((s) => s.done).length, economy: briefEconomy(project), results }
}

/** Строки блока «Экономика» (общие для экрана и экспорта). */
export function economyRows(c: CaseModel): [string, string][] {
  const p = c.project
  const e = c.economy
  return [
    ['Средний чек', fmtTg(p.avgCheck)],
    ['Маржа', `${fmtNum(p.marginPct)}%`],
    ['Прибыль с продажи', fmtTg(e.profit)],
    ['Потолок цены клиента (CAC)', fmtTg(e.maxCac)],
    ['Целевая цена клиента', fmtTg(e.targetCac)],
    ['Потолок цены заявки (CPL)', fmtTg(e.maxCpl)],
    ['Целевая цена заявки', fmtTg(e.targetCpl)],
  ]
}

/** Строки блока «Результаты»: расход, воронка и ключевые метрики. */
export function resultRows(c: CaseModel): [string, string][] {
  const r = c.results
  if (!r) return []
  const t = r.totals
  const rows: [string, string][] = [
    ['Расход', fmtTg(t.spend)],
    ['Показы', fmtNum(t.impressions)],
    ['Клики', fmtNum(t.clicks)],
    ['Заявки', fmtNum(t.leads)],
    ['Продажи', fmtNum(t.sales)],
    ['Выручка', fmtTg(t.revenue)],
  ]
  if (r.m.cpm !== undefined) rows.push(['CPM', fmtTg(r.m.cpm)])
  if (r.m.ctr !== undefined) rows.push(['CTR', fmtPct(r.m.ctr)])
  if (r.m.cpl !== undefined) rows.push(['Цена заявки (CPL)', fmtTg(r.m.cpl)])
  if (r.m.cac !== undefined) rows.push(['Цена клиента (CAC)', fmtTg(r.m.cac)])
  if (r.m.roas !== undefined) rows.push(['ROAS', fmtPct(r.m.roas)])
  if (r.romi !== undefined) rows.push(['ROMI', fmtPct(r.romi)])
  return rows
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const para = (s: string) => esc(s).replace(/\n/g, '<br>')
const dayRu = (iso: string) => new Date(iso).toLocaleDateString('ru-RU')

/** Самодостаточная HTML-страница кейса: фото внутри (data URL), светлая тема для печати и PDF. */
export function renderCaseHtml(c: CaseModel, photos: Map<number, string>, opts: { training: boolean; houseName: string }): string {
  const table = (rows: [string, string][]) => `<table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`
  const steps = c.steps
    .map((s) => {
      const proof = !s.done
        ? '<p class="muted">Шаг ещё не сдан.</p>'
        : [
            photos.get(s.key) ? `<img src="${esc(photos.get(s.key)!)}" alt="Пруф шага ${s.n}">` : '',
            s.value !== undefined ? `<p class="val">${esc(s.numberLabel ?? 'Цифра')}: <b>${esc(fmtNum(s.value))}</b></p>` : '',
          ].join('')
      return `<section class="step"><h3>${s.n}. ${esc(s.title)}</h3>${s.deliverable ? `<p class="muted">${esc(s.deliverable)}</p>` : ''}${s.note ? `<p>${para(s.note)}</p>` : ''}${proof}${s.at ? `<p class="muted small">Сдан ${dayRu(s.at)}</p>` : ''}</section>`
    })
    .join('')

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Кейс: ${esc(c.project.name)}</title>
<style>
body{font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1c1c1f;max-width:780px;margin:0 auto;padding:24px 18px 60px}
h1{font-size:28px;margin:0 0 4px}h2{font-size:20px;margin:32px 0 8px;border-bottom:2px solid #c9a227;padding-bottom:4px}h3{font-size:17px;margin:0 0 4px}
.muted{color:#6b6b73}.small{font-size:13px}.tag{display:inline-block;border:1px solid #c9a227;color:#8a6d0b;border-radius:999px;padding:1px 10px;font-size:13px;margin-left:8px;vertical-align:middle}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e4e4e7}th{font-weight:500;color:#52525b;width:60%}td{font-variant-numeric:tabular-nums}
.step{margin:18px 0;padding:14px 16px;border:1px solid #e4e4e7;border-radius:12px;break-inside:avoid}img{max-width:100%;border-radius:8px;margin-top:8px;border:1px solid #e4e4e7}.val{margin:6px 0 0}
footer{margin-top:40px;font-size:13px;color:#8a8a93}
</style></head><body>
<h1>${esc(c.project.name)}${opts.training ? '<span class="tag">учебный проект</span>' : ''}</h1>
<p class="muted">${esc(c.project.niche)}${c.project.niche ? ' · ' : ''}${esc(opts.houseName)} · шагов сдано ${c.doneCount} из ${c.steps.length}</p>
<h2>Экономика проекта</h2>${table(economyRows(c))}
${c.results ? `<h2>Результаты кампании</h2>${table(resultRows(c))}<p class="muted small">Сумма по ${c.results.reports} недельным отчётам. Охват между неделями не суммируется.</p>` : ''}
<h2>Шаги проекта</h2>${steps}
<footer>Собрано в игре «Династия».</footer>
</body></html>`
}
