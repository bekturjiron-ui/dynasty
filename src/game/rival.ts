// «Дом Вернеров»: вымышленный соперник, который проходит план ровно в срок.
// Его XP — сколько набрал бы игрок, закрывающий каждую неделю вовремя.
import type { Content } from '../content/schema'
import { addDays, daysBetween } from '../lib/dates'
import { CONTRACT_REWARD, TOTAL_WEEKS } from './engine'

/** Типичная неделя без готового контента: 5 уроков по 30 XP + босс + контракт. */
const TYPICAL_LESSONS_XP = 5 * 30
const TYPICAL_BOSS_XP = 100

/** XP соперника по итогам каждой недели: [0] = старт, [n] = конец недели n. */
export function rivalCurve(content: Content): number[] {
  const out = [0]
  let sum = 0
  const total = content.weeks.length || TOTAL_WEEKS
  for (let n = 1; n <= total; n++) {
    const w = content.weeks.find((x) => x.n === n)
    const lessons = w?.lessonIds.filter((id) => content.lessons[id]) ?? []
    sum += lessons.length ? lessons.reduce((s, id) => s + content.lessons[id].reward.xp, 0) : TYPICAL_LESSONS_XP
    const boss = w?.bossId ? content.bosses[w.bossId] : undefined
    // Диалог с поставщиком играет роль босса недели: «типичный босс» ему не добавляем
    sum += boss ? boss.reward.xp : w && w.bossTitle !== '—' && !w.negotiationId ? TYPICAL_BOSS_XP : 0
    const neg = w?.negotiationId ? content.negotiations[w.negotiationId] : undefined
    if (neg) sum += neg.reward.xp
    sum += CONTRACT_REWARD.xp
    for (const m of content.missions.filter((x) => x.weekKey === (w?.key ?? n))) sum += m.reward.xp
    out.push(sum)
  }
  return out
}

/** XP соперника через `days` дней после старта. Растягивание плана сдвигает и его график. */
export function rivalXpAt(curve: number[], days: number, planOffsetWeeks = 0): number {
  const w = days / 7 - planOffsetWeeks
  if (w <= 0) return 0
  const total = curve.length - 1
  if (w >= total) return curve[total]
  const full = Math.floor(w)
  return Math.round(curve[full] + (curve[full + 1] - curve[full]) * (w - full))
}

export type DuelPoint = { label: string; me: number; rival: number }

/** Точки графика по неделям: XP игрока (из дневной активности) против соперника. */
export function duelSeries(
  content: Content,
  startedAt: string,
  today: string,
  activity: { day: string; xp: number }[],
  planOffsetWeeks = 0,
): DuelPoint[] {
  const curve = rivalCurve(content)
  const elapsed = Math.max(0, daysBetween(startedAt, today))
  const weeks = Math.min(curve.length - 1 + planOffsetWeeks, Math.floor(elapsed / 7) + 1)
  const pts: DuelPoint[] = [{ label: 'Старт', me: 0, rival: 0 }]
  for (let k = 1; k <= weeks; k++) {
    const endDay = Math.min(7 * k, elapsed + 1) // текущая неделя — по сегодняшний день
    const until = addDays(startedAt, endDay - 1)
    const me = activity.filter((a) => a.day <= until).reduce((s, a) => s + a.xp, 0)
    pts.push({ label: `Н${k}`, me, rival: rivalXpAt(curve, endDay, planOffsetWeeks) })
  }
  return pts
}

/** XP за последние 7 дней и за 7 дней до них — «сравнение с собой неделю назад». */
export function weekOverWeek(activity: { day: string; xp: number }[], today: string) {
  const d7 = addDays(today, -6), d14 = addDays(today, -13)
  const sum = (from: string, to: string) => activity.filter((a) => a.day >= from && a.day <= to).reduce((s, a) => s + a.xp, 0)
  return { thisWeek: sum(d7, today), lastWeek: sum(d14, addDays(d7, -1)) }
}
