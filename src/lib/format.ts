const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
const nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })
const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

export const fmtNum = (n: number) => nf.format(n)
export const fmtTg = (n: number) => `${nf0.format(Math.round(n))} ₸`
export const fmtPct = (fraction: number) => `${nf1.format(fraction * 100)}%`

export type Unit = 'tg' | 'pct' | 'num'
export const fmtUnit = (n: number, unit: Unit) => (unit === 'tg' ? fmtTg(n) : unit === 'pct' ? fmtPct(n) : fmtNum(n))

/** Разбор числа, введённого игроком: «12 345,5 ₸», «23,5%», «-668». */
export function parseUserNumber(s: string): number | null {
  const clean = s.replace(/[\s  ₸%]/g, '').replace(',', '.').replace('−', '-')
  if (!/^-?\d*\.?\d+$/.test(clean)) return null
  return parseFloat(clean)
}

/** Ответ игрока в единицах задания → в «сырые» единицы (для pct — доли). */
export const toRaw = (n: number, unit: Unit) => (unit === 'pct' ? n / 100 : n)

/** Совпадает ли ответ с допуском (относительный tolerance + минимальный абсолютный). */
export function closeEnough(answerRaw: number, correct: number, tolerance: number, unit: Unit): boolean {
  const absMin = unit === 'tg' ? 1 : unit === 'pct' ? 0.001 : 0.005
  return Math.abs(answerRaw - correct) <= Math.max(Math.abs(correct) * tolerance, absMin)
}
