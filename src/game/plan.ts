// План поверх контента: наставник правит недели, порядок, тексты, свои миссии.
// Базовый план — content/plan.json; правки — в IndexedDB (таблица plan). Прогресс привязан к Week.key, не к позиции.
import { z } from 'zod'
import { MissionSchema, WeekSchema, type Content, type Mission, type Week } from '../content/schema'
import { addDays } from '../lib/dates'

export const weekKey = (w: Week) => w.key ?? w.n

/** Нумерация по порядку: n = позиция, key сохраняется. */
export const renumber = (weeks: Week[]): Week[] => weeks.map((w, i) => ({ ...w, key: weekKey(w), n: i + 1 }))

const MERGED_FIELDS = ['act', 'title', 'bossId', 'negotiationId', 'bossTitle', 'contract', 'resource', 'deadline'] as const
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

/**
 * Накладывает правки на новую версию базового плана. Поле берётся из правок, только если человек его менял
 * (отличается от snapshot — базы на момент сохранения). Иначе берётся новая версия игры.
 * Старые записи без snapshot хранили лишь порядок уроков или правки до появления этой логики: у них сохраняем порядок уроков и свои недели (key > 100).
 */
export function rebaseWeeks(baseWeeks: Week[], ownWeeks: Week[], snapshot?: Week[]): Week[] {
  const snap = new Map((snapshot ?? ownWeeks).map((w) => [weekKey(w), w]))
  const baseBy = new Map(baseWeeks.map((w) => [weekKey(w), w]))
  const ownBy = new Map(ownWeeks.map((w) => [weekKey(w), w]))
  const isCustom = (w: Week) => !baseBy.has(weekKey(w)) && (snapshot ? !snap.has(weekKey(w)) : weekKey(w) > 100)

  const merged = (b: Week): Week => {
    const o = ownBy.get(weekKey(b))
    if (!o) return b
    const s = snap.get(weekKey(b)) ?? o
    const out: Week = { ...b }
    for (const f of MERGED_FIELDS) if (!same(o[f], s[f])) Object.assign(out, { [f]: o[f] })
    out.lessonIds = sameSet(o.lessonIds, s.lessonIds)
      ? [...o.lessonIds.filter((id) => b.lessonIds.includes(id)), ...b.lessonIds.filter((id) => !o.lessonIds.includes(id))]
      : o.lessonIds
    return out
  }

  // неделя из базы, которую наставник удалил, остаётся удалённой
  const baseList = baseWeeks.filter((b) => !snapshot || !snap.has(weekKey(b)) || ownBy.has(weekKey(b)))
  const ownOrder = ownWeeks.map(weekKey).filter((k) => snap.has(k))
  const snapOrder = (snapshot ?? ownWeeks).map(weekKey).filter((k) => ownBy.has(k))
  const kept = ownWeeks.filter((w) => baseBy.has(weekKey(w)) || isCustom(w))

  if (snapshot && !same(ownOrder, snapOrder)) {
    // наставник переставлял недели: держим его порядок, новые недели вставляем на их место в базе
    const seq = kept.map((w) => (baseBy.has(weekKey(w)) ? merged(baseBy.get(weekKey(w))!) : w))
    baseList.forEach((b, i) => { if (!ownBy.has(weekKey(b))) seq.splice(Math.min(i, seq.length), 0, b) })
    return seq
  }
  const seq = baseList.map(merged)
  ownWeeks.forEach((w, i) => {
    if (!isCustom(w)) return
    const prev = i > 0 ? seq.findIndex((x) => weekKey(x) === weekKey(ownWeeks[i - 1])) : -1
    seq.splice(prev < 0 ? (i === 0 ? 0 : seq.length) : prev + 1, 0, w)
  })
  return seq
}

/** Контент с учётом правок наставника. */
export function effectiveContent(base: Content, override?: { weeks: Week[]; missions?: Mission[]; baseWeeks?: Week[]; baseMissionIds?: string[] }): Content {
  if (!override?.weeks?.length) return base
  // уроки/боссы, которых больше нет в контенте, тихо выкидываем — план не должен ломать игру
  const weeks = renumber(rebaseWeeks(base.weeks, override.weeks, override.baseWeeks)).map((w) => ({
    ...w,
    lessonIds: w.lessonIds.filter((id) => base.lessons[id]),
    bossId: w.bossId && base.bosses[w.bossId] ? w.bossId : undefined,
    negotiationId: w.negotiationId && base.negotiations[w.negotiationId] ? w.negotiationId : undefined,
  }))
  const keys = new Set(weeks.map(weekKey))
  // свои миссии наставника + миссии, которых не было в базе на момент сохранения (новые из обновления игры)
  const known = new Set(override.baseMissionIds ?? base.missions.map((m) => m.id))
  const own = override.missions ?? []
  const added = base.missions.filter((m) => !known.has(m.id) && !own.some((o) => o.id === m.id))
  return { ...base, weeks, missions: [...own, ...added].filter((m) => keys.has(m.weekKey)) }
}

/** Дедлайн недели: свой или конец недели по дате старта и растяжению. */
export function deadlineOf(w: Week, startedAt: string, planOffsetWeeks = 0): string {
  return w.deadline ?? addDays(startedAt, 7 * (w.n + planOffsetWeeks) - 1)
}

export const nextWeekKey = (weeks: Week[]) => Math.max(100, ...weeks.map(weekKey)) + 1

// ---------- Файл плана ----------
export const PlanFileSchema = z.object({
  app: z.literal('dynasty-plan'),
  version: z.literal(1),
  weeks: z.array(WeekSchema).min(1).max(60),
  missions: z.array(MissionSchema).default([]),
})
export type PlanFile = z.infer<typeof PlanFileSchema>

export function planToFile(weeks: Week[], missions: Mission[]): Blob {
  const data: PlanFile = { app: 'dynasty-plan', version: 1, weeks: renumber(weeks), missions }
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

/** Разбор файла плана. Проверяет схему, уникальность ключей и что миссии ссылаются на существующие недели. */
export function parsePlanFile(text: string, base: Content): { weeks: Week[]; missions: Mission[]; warnings: string[] } {
  let json: unknown
  try { json = JSON.parse(text) } catch { throw new Error('файл повреждён или это не JSON') }
  if ((json as { app?: string })?.app !== 'dynasty-plan') throw new Error('это не файл плана «Династии» (его делает кнопка «Скачать план»)')
  const res = PlanFileSchema.safeParse(json)
  if (!res.success) throw new Error(`в плане ошибка — ${z.prettifyError(res.error).split('\n').slice(0, 2).join(' ')}`)
  const weeks = renumber(res.data.weeks)
  const keys = new Set(weeks.map(weekKey))
  if (keys.size !== weeks.length) throw new Error('В плане повторяются ключи недель')
  const warnings: string[] = []
  for (const w of weeks) {
    const missing = w.lessonIds.filter((id) => !base.lessons[id])
    if (missing.length) warnings.push(`Неделя ${w.n}: уроков ${missing.join(', ')} нет в этой версии игры — пропущены`)
  }
  const missions = res.data.missions.filter((m) => keys.has(m.weekKey))
  if (missions.length < res.data.missions.length) warnings.push('Часть миссий ссылалась на несуществующие недели — пропущены')
  return { weeks, missions, warnings }
}

/** Новая неделя-заготовка для редактора. */
export function blankWeek(weeks: Week[], act: string): Week {
  return {
    n: weeks.length + 1,
    key: nextWeekKey(weeks),
    act,
    title: 'Новая неделя',
    lessonIds: [],
    bossTitle: '—',
    contract: { text: 'Реальное действие в рекламном кабинете', proof: 'photo' },
  }
}
