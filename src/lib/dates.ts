/** Локальная дата в формате YYYY-MM-DD. */
export function dayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
export function parseDay(k: string): Date {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000)
}
export function addDays(k: string, n: number): string {
  const d = parseDay(k)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}
/** Понедельник недели — ключ недели для «щита». */
export function weekStart(k: string): string {
  const d = parseDay(k)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return dayKey(d)
}
