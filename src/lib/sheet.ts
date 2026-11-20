// Мини-движок формул в стиле Excel/Google Таблиц для тренажёра 5×5.
import { evaluate, type Fn } from './expr'

export type Raw = string | number | null
export type Grid = Raw[][]

export const colLetter = (c: number) => String.fromCharCode(65 + c)
export const addr = (r: number, c: number) => `${colLetter(c)}${r + 1}`
export function parseAddr(a: string): { r: number; c: number } {
  const m = /^\$?([A-Z])\$?(\d+)$/.exec(a.toUpperCase().trim())
  if (!m) throw new Error(`Странный адрес «${a}»`)
  return { r: parseInt(m[2], 10) - 1, c: m[1].charCodeAt(0) - 65 }
}

const PCT = /^-?\d+(?:[.,]\d+)?\s*%$/
const NUM = /^-?\d+(?:[.,]\d+)?$/
const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

export const isFormula = (v: Raw): boolean => typeof v === 'string' && v.trim().startsWith('=')

const flat = (a: unknown[]): number[] =>
  (a.flat(3) as unknown[]).map((x) => Number(x)).filter((x) => Number.isFinite(x))
const FUNCS: Record<string, Fn> = {
  SUM: (...a) => flat(a).reduce((s, x) => s + x, 0),
  AVERAGE: (...a) => { const f = flat(a); return f.length ? f.reduce((s, x) => s + x, 0) / f.length : 0 },
  MIN: (...a) => Math.min(...flat(a)),
  MAX: (...a) => Math.max(...flat(a)),
  COUNT: (...a) => flat(a).length,
  ROUND: (x, d = 0) => { const f = 10 ** Number(d); return Math.round(Number(x) * f) / f },
  ABS: (x) => Math.abs(Number(x)),
  IF: (c, a, b = 0) => (c ? a : b),
}
const RU: [RegExp, string][] = [
  [/СРЗНАЧ(?=\s*\()/g, 'AVERAGE'], [/СУММ(?=\s*\()/g, 'SUM'], [/ОКРУГЛ(?=\s*\()/g, 'ROUND'],
  [/ЕСЛИ(?=\s*\()/g, 'IF'], [/МИН(?=\s*\()/g, 'MIN'], [/МАКС(?=\s*\()/g, 'MAX'], [/СЧ[ЕЁ]Т(?=\s*\()/g, 'COUNT'],
]

/** Переводит формулу таблицы в выражение нашего вычислителя. */
export function translate(formula: string): string {
  let s = formula.trim().replace(/^=/, '').toUpperCase()
  if (/["']/.test(s)) throw new Error('Текст в кавычках тренажёр пока не понимает')
  for (const [re, en] of RU) s = s.replace(re, en)
  // Русская раскладка: «;» — разделитель аргументов, «,» — десятичная запятая
  if (s.includes(';') || !s.includes('(')) s = s.replace(/(\d),(\d)/g, '$1.$2')
  s = s.replace(/;/g, ',')
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)')
  s = s.replace(/\$?([A-Z])\$?(\d+)\s*:\s*\$?([A-Z])\$?(\d+)/g, (_m, c1: string, r1: string, c2: string, r2: string) => {
    const cells: string[] = []
    const [ca, cb] = [c1.charCodeAt(0), c2.charCodeAt(0)].sort((x, y) => x - y)
    const [ra, rb] = [+r1, +r2].sort((x, y) => x - y)
    for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) cells.push(`${String.fromCharCode(c)}${r}`)
    return cells.join(',')
  })
  s = s.replace(/(^|[^A-Z0-9_])\$?([A-Z])\$?(\d+)(?![0-9A-Z_(])/g, '$1c_$2$3')
  s = s.replace(/<>/g, '!=').replace(/(?<![<>!=])=(?!=)/g, '==')
  return s
}

/** Адреса ячеек, на которые ссылается формула. */
export function formulaRefs(formula: string): string[] {
  try {
    return [...translate(formula).matchAll(/c_([A-Z]\d+)/g)].map((m) => m[1])
  } catch {
    return []
  }
}

/** Числовое значение ячейки (текст → 0, как SUM в Excel). */
export function cellValue(grid: Grid, a: string, visiting = new Set<string>()): number {
  const { r, c } = parseAddr(a)
  const v = grid[r]?.[c] ?? null
  if (v === null || v === '') return 0
  if (typeof v === 'number') return v
  const t = v.trim()
  if (t.startsWith('=')) {
    if (visiting.has(a)) throw new Error(`Формула ссылается сама на себя (${a})`)
    visiting.add(a)
    try {
      return evalFormula(t, grid, visiting)
    } finally {
      visiting.delete(a)
    }
  }
  if (PCT.test(t)) return parseFloat(t.replace(',', '.')) / 100
  if (NUM.test(t)) return parseFloat(t.replace(',', '.'))
  return 0
}

export function evalFormula(formula: string, grid: Grid, visiting = new Set<string>()): number {
  const expr = translate(formula)
  const scope: Record<string, unknown> = {}
  for (const m of expr.matchAll(/c_([A-Z]\d+)/g)) {
    const key = `c_${m[1]}`
    if (!(key in scope)) scope[key] = cellValue(grid, m[1], visiting)
  }
  const v = evaluate(expr, scope, FUNCS)
  const n = typeof v === 'boolean' ? (v ? 1 : 0) : Number(v)
  if (!Number.isFinite(n)) throw new Error('Формула не даёт число (деление на ноль?)')
  return n
}

/** Что показать в ячейке: результат формулы или исходный текст. */
export function displayCell(grid: Grid, r: number, c: number): { text: string; isNum: boolean; error?: boolean } {
  const v = grid[r]?.[c] ?? null
  if (v === null || v === '') return { text: '', isNum: false }
  if (typeof v === 'number') return { text: nf.format(v), isNum: true }
  if (isFormula(v)) {
    try {
      return { text: nf.format(evalFormula(v as string, grid, new Set([addr(r, c)]))), isNum: true }
    } catch {
      return { text: '#ЗНАЧ!', isNum: false, error: true }
    }
  }
  const t = v.trim()
  if (NUM.test(t)) return { text: nf.format(parseFloat(t.replace(',', '.'))), isNum: true }
  return { text: v, isNum: PCT.test(t) }
}
