// Проверка ответов в тренажёре таблицы.
import { looseEq } from '../lib/expr'
import { evalFormula, formulaRefs, isFormula, NOT_FOUND, parseAddr, straightQuotes, type CellResult, type Grid } from '../lib/sheet'
import type { SheetTask } from './schema'

// Длинные имена раньше коротких: СУММЕСЛИ не должна превратиться в SUMЕСЛИ
const RU_FN: [RegExp, string][] = [
  [/СЧ[ЕЁ]ТЕСЛИ/g, 'COUNTIF'], [/СУММЕСЛИ/g, 'SUMIF'], [/ПРОСМОТРХ/g, 'XLOOKUP'], [/ВПР/g, 'VLOOKUP'],
  [/СРЗНАЧ/g, 'AVERAGE'], [/СУММ/g, 'SUM'], [/ОКРУГЛ/g, 'ROUND'], [/ЕСЛИ/g, 'IF'], [/МИН/g, 'MIN'], [/МАКС/g, 'MAX'], [/СЧ[ЕЁ]Т/g, 'COUNT'],
  [/ЛОЖЬ|FALSE/g, '0'],
]
export function normalizeFormula(f: string): string {
  let s = straightQuotes(f).toUpperCase().replace(/\s+/g, '')
  for (const [re, en] of RU_FN) s = s.replace(re, en)
  return s.replace(/;/g, ',')
}

export const cloneGrid = (g: Grid): Grid => g.map((r) => [...r])

export function setCell(g: Grid, a: string, v: string | number | null): Grid {
  const out = cloneGrid(g)
  const { r, c } = parseAddr(a)
  while (out.length <= r) out.push([])
  while (out[r].length <= c) out[r].push(null)
  out[r][c] = v
  return out
}

/** Эталонные значения целевых ячеек: в сетку подставлены все эталонные формулы. */
export function expectedValues(grid: Grid, task: SheetTask): Record<string, CellResult> {
  let g = grid
  for (const t of task.targets) g = setCell(g, t.cell, t.solution)
  return Object.fromEntries(task.targets.map((t) => [t.cell, evalFormula(t.solution, g, new Set([t.cell]))]))
}

/** Группы ABC: на русской раскладке А, В, С выглядят так же, как латинские A, B, C. */
const latinLookalikes = (v: CellResult): CellResult =>
  typeof v === 'string' ? v.toUpperCase().replace(/А/g, 'A').replace(/В/g, 'B').replace(/С/g, 'C') : v

export type SheetVerdict =
  | { ok: true; value: CellResult }
  | { ok: false; reason: 'empty' | 'not_formula' | 'no_refs' | 'missing' | 'error' | 'not_found' | 'value'; value?: CellResult; missing?: string; message?: string }

export function checkTarget(grid: Grid, cell: string, expected: CellResult, mustInclude: string[] = []): SheetVerdict {
  const { r, c } = parseAddr(cell)
  const raw = grid[r]?.[c]
  if (raw === null || raw === undefined || raw === '') return { ok: false, reason: 'empty' }
  if (typeof raw !== 'string' || !isFormula(raw)) return { ok: false, reason: 'not_formula' }
  if (formulaRefs(raw).length === 0) return { ok: false, reason: 'no_refs' }
  const norm = normalizeFormula(raw)
  const miss = mustInclude.find((m) => !norm.includes(normalizeFormula(m)))
  let value: CellResult
  try {
    value = evalFormula(raw, grid, new Set([cell]))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return message === NOT_FOUND ? { ok: false, reason: 'not_found' } : { ok: false, reason: 'error', message }
  }
  if (miss) return { ok: false, reason: 'missing', missing: miss, value }
  const ok = typeof expected === 'string' || typeof value === 'string'
    ? looseEq(latinLookalikes(value), latinLookalikes(expected))
    : Math.abs(value - expected) <= Math.max(Math.abs(expected) * 1e-6, 0.005)
  return ok ? { ok: true, value } : { ok: false, reason: 'value', value }
}
