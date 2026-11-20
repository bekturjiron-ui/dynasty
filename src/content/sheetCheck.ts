// Проверка ответов в тренажёре таблицы.
import { evalFormula, formulaRefs, isFormula, parseAddr, type Grid } from '../lib/sheet'
import type { SheetTask } from './schema'

const RU_FN: [RegExp, string][] = [
  [/СРЗНАЧ/g, 'AVERAGE'], [/СУММ/g, 'SUM'], [/ОКРУГЛ/g, 'ROUND'], [/ЕСЛИ/g, 'IF'], [/МИН/g, 'MIN'], [/МАКС/g, 'MAX'], [/СЧ[ЕЁ]Т/g, 'COUNT'],
]
export function normalizeFormula(f: string): string {
  let s = f.toUpperCase().replace(/\s+/g, '')
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
export function expectedValues(grid: Grid, task: SheetTask): Record<string, number> {
  let g = grid
  for (const t of task.targets) g = setCell(g, t.cell, t.solution)
  return Object.fromEntries(task.targets.map((t) => [t.cell, evalFormula(t.solution, g, new Set([t.cell]))]))
}

export type SheetVerdict =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'not_formula' | 'no_refs' | 'missing' | 'error' | 'value'; value?: number; missing?: string; message?: string }

export function checkTarget(grid: Grid, cell: string, expected: number, mustInclude: string[] = []): SheetVerdict {
  const { r, c } = parseAddr(cell)
  const raw = grid[r]?.[c]
  if (raw === null || raw === undefined || raw === '') return { ok: false, reason: 'empty' }
  if (typeof raw !== 'string' || !isFormula(raw)) return { ok: false, reason: 'not_formula' }
  if (formulaRefs(raw).length === 0) return { ok: false, reason: 'no_refs' }
  const norm = normalizeFormula(raw)
  const miss = mustInclude.find((m) => !norm.includes(normalizeFormula(m)))
  let value: number
  try {
    value = evalFormula(raw, grid, new Set([cell]))
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) }
  }
  if (miss) return { ok: false, reason: 'missing', missing: miss, value }
  const ok = Math.abs(value - expected) <= Math.max(Math.abs(expected) * 1e-6, 0.005)
  return ok ? { ok: true, value } : { ok: false, reason: 'value', value }
}
