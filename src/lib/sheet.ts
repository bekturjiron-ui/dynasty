// Мини-движок формул в стиле Excel/Google Таблиц для тренажёра 5×5.
import { evaluate, looseEq, type Fn } from './expr'

export type Raw = string | number | null
export type Grid = Raw[][]
/** Результат формулы: число или текст (ЕСЛИ, ВПР, ПРОСМОТРХ). */
export type CellResult = number | string

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
/** Значение, которого нет в таблице поиска, — как в Excel. */
export const NOT_FOUND = '#Н/Д'

export const isFormula = (v: Raw): boolean => typeof v === 'string' && v.trim().startsWith('=')
/** Клавиатура iPhone подменяет прямые кавычки на «умные». */
export const straightQuotes = (s: string) => s.replace(/[«»“”„‟″]/g, '"')

const cells = (a: unknown): unknown[] => (Array.isArray(a) ? (a.flat(3) as unknown[]) : [a])
const flat = (a: unknown[]): number[] => (a.flat(3) as unknown[]).filter((x): x is number => typeof x === 'number' && Number.isFinite(x))

/** Условие СЧЁТЕСЛИ/СУММЕСЛИ: значение или ">100", "<>Отменён". Пустые ячейки не подходят. */
function matches(v: unknown, crit: unknown): boolean {
  if (v === null || v === undefined) return false
  const m = typeof crit === 'string' ? /^(<>|>=|<=|>|<|=)(.*)$/.exec(crit.trim()) : null
  if (!m) return looseEq(v, crit)
  const raw = m[2].trim().replace(',', '.')
  const target: unknown = NUM.test(raw) ? parseFloat(raw) : m[2].trim()
  if (m[1] === '=') return looseEq(v, target)
  if (m[1] === '<>') return !looseEq(v, target)
  if (typeof v !== 'number' || typeof target !== 'number') return false
  return m[1] === '>' ? v > target : m[1] === '<' ? v < target : m[1] === '>=' ? v >= target : v <= target
}

const FUNCS: Record<string, Fn> = {
  RNG: (rows, cols, ...v) => Array.from({ length: Number(rows) }, (_, r) => v.slice(r * Number(cols), (r + 1) * Number(cols))),
  SUM: (...a) => flat(a).reduce((s, x) => s + x, 0),
  AVERAGE: (...a) => { const f = flat(a); return f.length ? f.reduce((s, x) => s + x, 0) / f.length : 0 },
  MIN: (...a) => Math.min(...flat(a)),
  MAX: (...a) => Math.max(...flat(a)),
  COUNT: (...a) => flat(a).length,
  ROUND: (x, d = 0) => { const f = 10 ** Number(d); return Math.round(Number(x) * f) / f },
  ABS: (x) => Math.abs(Number(x)),
  IF: (c, a, b = 0) => (c ? a : b),
  VLOOKUP: (key, table, col, approx = 1) => {
    if (!Array.isArray(table)) throw new Error('Второй аргумент ВПР — диапазон таблицы')
    const rows = table as unknown[][]
    const idx = Number(col) - 1
    if (!Number.isInteger(idx) || idx < 0 || idx >= (rows[0]?.length ?? 0)) throw new Error('В диапазоне ВПР нет такого столбца')
    let hit = -1
    if (!Number(approx)) hit = rows.findIndex((r) => r[0] !== null && looseEq(r[0], key))
    else rows.forEach((r, i) => {
      const v = r[0]
      if (typeof v === 'number' && typeof key === 'number' ? v <= key : typeof v === 'string' && typeof key === 'string' && v.localeCompare(key, 'ru') <= 0) hit = i
    })
    if (hit < 0) throw new Error(NOT_FOUND)
    return rows[hit][idx] ?? 0
  },
  XLOOKUP: (key, where, what, ...notFound) => {
    const from = cells(where), to = cells(what)
    if (from.length !== to.length) throw new Error('Диапазоны ПРОСМОТРХ разной длины')
    const i = from.findIndex((v) => v !== null && looseEq(v, key))
    if (i >= 0) return to[i] ?? 0
    if (notFound.length) return notFound[0]
    throw new Error(NOT_FOUND)
  },
  COUNTIF: (range, crit) => cells(range).filter((v) => matches(v, crit)).length,
  SUMIF: (range, crit, sumRange) => {
    const from = cells(range), to = cells(sumRange ?? range)
    if (from.length !== to.length) throw new Error('Диапазоны СУММЕСЛИ разной длины')
    return from.reduce<number>((s, v, i) => (matches(v, crit) && typeof to[i] === 'number' ? s + (to[i] as number) : s), 0)
  },
}
const RU: [RegExp, string][] = [
  [/СЧ[ЕЁ]ТЕСЛИ(?=\s*\()/g, 'COUNTIF'], [/СУММЕСЛИ(?=\s*\()/g, 'SUMIF'], [/ПРОСМОТРХ(?=\s*\()/g, 'XLOOKUP'], [/ВПР(?=\s*\()/g, 'VLOOKUP'],
  [/СРЗНАЧ(?=\s*\()/g, 'AVERAGE'], [/СУММ(?=\s*\()/g, 'SUM'], [/ОКРУГЛ(?=\s*\()/g, 'ROUND'],
  [/ЕСЛИ(?=\s*\()/g, 'IF'], [/МИН(?=\s*\()/g, 'MIN'], [/МАКС(?=\s*\()/g, 'MAX'], [/СЧ[ЕЁ]Т(?=\s*\()/g, 'COUNT'],
]

function decimalCommaOutsideParens(s: string): string {
  let depth = 0
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    out += ch === ',' && depth === 0 && /\d/.test(s[i - 1] ?? '') && /\d/.test(s[i + 1] ?? '') ? '.' : ch
  }
  return out
}

/** Переводит формулу таблицы в выражение нашего вычислителя. Текст в кавычках не трогает. */
export function translate(formula: string): string {
  const texts: string[] = []
  const quoted = straightQuotes(formula).trim().replace(/^=/, '')
  if ((quoted.match(/"/g)?.length ?? 0) % 2) throw new Error('Не закрыта кавычка')
  let s = quoted.replace(/"([^"]*)"/g, (_m, t: string) => `§${texts.push(t) - 1}§`).toUpperCase()
  if (s.includes("'")) throw new Error('Текст пишут в двойных кавычках')
  for (const [re, en] of RU) s = s.replace(re, en)
  s = s.replace(/(^|[^A-ZА-ЯЁ0-9_])(?:ЛОЖЬ|FALSE)(?![A-ZА-ЯЁ0-9_])/g, '$10').replace(/(^|[^A-ZА-ЯЁ0-9_])(?:ИСТИНА|TRUE)(?![A-ZА-ЯЁ0-9_])/g, '$11')
  // Русская раскладка: «;» — разделитель аргументов, «,» — десятичная запятая
  // Без «;» запятая внутри скобок — разделитель аргументов, а вне скобок она может быть только дробной: =СУММ(B2:B4)*1,2
  if (s.includes(';')) s = s.replace(/(\d),(\d)/g, '$1.$2')
  else s = decimalCommaOutsideParens(s)
  s = s.replace(/;/g, ',')
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)')
  s = s.replace(/\$?([A-Z])\$?(\d+)\s*:\s*\$?([A-Z])\$?(\d+)/g, (_m, c1: string, r1: string, c2: string, r2: string) => {
    const out: string[] = []
    const [ca, cb] = [c1.charCodeAt(0), c2.charCodeAt(0)].sort((x, y) => x - y)
    const [ra, rb] = [+r1, +r2].sort((x, y) => x - y)
    for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) out.push(`${String.fromCharCode(c)}${r}`)
    return `RNG(${rb - ra + 1},${cb - ca + 1},${out.join(',')})`
  })
  s = s.replace(/(^|[^A-Z0-9_])\$?([A-Z])\$?(\d+)(?![0-9A-Z_(])/g, '$1c_$2$3')
  s = s.replace(/<>/g, '!=').replace(/(?<![<>!=])=(?!=)/g, '==')
  return s.replace(/§(\d+)§/g, (_m, i: string) => `"${texts[+i]}"`)
}

/** Адреса ячеек, на которые ссылается формула. */
export function formulaRefs(formula: string): string[] {
  try {
    return [...translate(formula).replace(/"[^"]*"/g, '').matchAll(/c_([A-Z]\d+)/g)].map((m) => m[1])
  } catch {
    return []
  }
}

/** Значение ячейки: число, текст или null для пустой. */
function cellRaw(grid: Grid, a: string, visiting: Set<string>): CellResult | null {
  const { r, c } = parseAddr(a)
  const v = grid[r]?.[c] ?? null
  if (v === null || v === '') return null
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
  return t
}

export function evalFormula(formula: string, grid: Grid, visiting = new Set<string>()): CellResult {
  const expr = translate(formula)
  const scope: Record<string, unknown> = {}
  for (const m of expr.replace(/"[^"]*"/g, '').matchAll(/c_([A-Z]\d+)/g)) {
    const key = `c_${m[1]}`
    if (!(key in scope)) scope[key] = cellRaw(grid, m[1], visiting)
  }
  const v = evaluate(expr, scope, FUNCS, { sheet: true })
  if (typeof v === 'string') return v
  const n = typeof v === 'boolean' ? (v ? 1 : 0) : Number(v ?? 0)
  if (!Number.isFinite(n)) throw new Error('Формула не даёт число (деление на ноль или текст в расчёте?)')
  return n
}

/** Что показать в ячейке: результат формулы или исходный текст. */
export function displayCell(grid: Grid, r: number, c: number): { text: string; isNum: boolean; error?: boolean } {
  const v = grid[r]?.[c] ?? null
  if (v === null || v === '') return { text: '', isNum: false }
  if (typeof v === 'number') return { text: nf.format(v), isNum: true }
  if (isFormula(v)) {
    try {
      const res = evalFormula(v as string, grid, new Set([addr(r, c)]))
      return typeof res === 'string' ? { text: res, isNum: false } : { text: nf.format(res), isNum: true }
    } catch (e) {
      return { text: e instanceof Error && e.message === NOT_FOUND ? NOT_FOUND : '#ЗНАЧ!', isNum: false, error: true }
    }
  }
  const t = v.trim()
  if (NUM.test(t)) return { text: nf.format(parseFloat(t.replace(',', '.'))), isNum: true }
  return { text: v, isNum: PCT.test(t) }
}
