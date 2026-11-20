// Базовый контекст для формул контента: товары, комиссии, спецтовары worst/best.
import { evaluate, evalNum, type Scope } from '../lib/expr'
import { render } from '../lib/template'
import type { Exercise, Product, Table } from './schema'
import type { Grid } from '../lib/sheet'

export type SettingsLike = { kaspiFeePct: number; deliveryCost: number; taxPct: number; packPct?: number }

export const PACK_DEFAULT_PCT = 1

export function unitProfit(p: Product, s: SettingsLike): number {
  const fee = s.kaspiFeePct / 100, tax = s.taxPct / 100, pack = (s.packPct ?? PACK_DEFAULT_PCT) / 100
  return p.price - p.price * fee - (p.delivery ?? s.deliveryCost) - p.price * tax - p.price * pack - p.cost - p.inbound
}

export function baseScope(products: Product[], s: SettingsLike): Scope {
  const scope: Scope = {
    fee: s.kaspiFeePct / 100,
    tax: s.taxPct / 100,
    pack: (s.packPct ?? PACK_DEFAULT_PCT) / 100,
    delivery: s.deliveryCost,
  }
  const withShort = products.map((p) => ({ ...p, short: p.short ?? p.name, delivery: p.delivery ?? s.deliveryCost }))
  for (const p of withShort) scope[p.id] = p
  const byProfit = [...withShort].sort((a, b) => unitProfit(a, s) - unitProfit(b, s))
  scope.worst = byProfit[0]
  scope.best = byProfit[byProfit.length - 1]
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
