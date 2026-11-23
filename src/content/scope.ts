// Базовый контекст для формул контента: учебные офферы o1…oN и их экономика.
import { evaluate, evalNum, type Scope } from '../lib/expr'
import { render } from '../lib/template'
import type { Exercise, Offer, Table } from './schema'
import type { Grid } from '../lib/sheet'

/** Потолки в ноль: прибыль с продажи → цена клиента → цена заявки → цена клика. */
export function offerEconomy(o: Pick<Offer, 'price' | 'margin' | 'clickToLead' | 'leadToSale'>) {
  const profit = o.price * o.margin
  const maxCac = profit
  const maxCpl = maxCac * o.leadToSale
  const maxCpc = maxCpl * o.clickToLead
  return { profit, maxCac, maxCpl, maxCpc }
}

export function baseScope(offers: Offer[]): Scope {
  const scope: Scope = {}
  for (const o of offers) scope[o.id] = { ...o, short: o.short ?? o.name, ...offerEconomy(o) }
  return scope
}

/** Добавляет к контексту переменные: число как есть, строка — выражение. */
export function withVars(scope: Scope, vars: Record<string, number | string>): Scope {
  const out: Scope = { ...scope }
  for (const [k, v] of Object.entries(vars)) out[k] = typeof v === 'number' ? v : evaluate(v, out)
  return out
}

export function exerciseScope(scope: Scope, ex: Exercise): Scope {
  return withVars(scope, ex.inputs)
}

/** Ячейки таблицы контента → сырые ячейки сетки. */
export function resolveTable(table: Table, scope: Scope): Grid {
  return table.map((row) =>
    row.map((cell) => {
      if (cell === null || typeof cell === 'number') return cell
      if (cell.startsWith('$')) {
        const v = evaluate(cell.slice(1), scope)
        return typeof v === 'number' ? Math.round(v * 100) / 100 : String(v)
      }
      if (cell.includes('{{')) return render(cell, scope)
      return cell
    }),
  )
}

export type CheckStep = { label: string; formula: string; unit: 'tg' | 'pct' | 'num'; hint?: string }

/** Шаги проверки: guided — все шаги, solo — только итог. */
export function checkSteps(ex: Exercise, mode: 'guided' | 'solo'): CheckStep[] {
  const unit = ex.unit
  if (mode === 'guided' && ex.steps?.length) return ex.steps.map((s) => ({ ...s, unit: s.unit ?? unit }))
  return [{ label: 'Ответ', formula: ex.answerFormula!, unit }]
}

export const correctValue = (formula: string, scope: Scope) => evalNum(formula, scope)
