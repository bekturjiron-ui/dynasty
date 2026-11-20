// План поверх контента: наставник правит недели, порядок, тексты, свои миссии.
// Базовый план — content/plan.json; правки — в IndexedDB (таблица plan). Прогресс привязан к Week.key, не к позиции.
import { z } from 'zod'
import { MissionSchema, WeekSchema, type Content, type Mission, type Week } from '../content/schema'
import { addDays } from '../lib/dates'

export const weekKey = (w: Week) => w.key ?? w.n

/** Нумерация по порядку: n = позиция, key сохраняется. */
export const renumber = (weeks: Week[]): Week[] => weeks.map((w, i) => ({ ...w, key: weekKey(w), n: i + 1 }))

/** Контент с учётом правок наставника. */
export function effectiveContent(base: Content, override?: { weeks: Week[]; missions?: Mission[] }): Content {
  if (!override?.weeks?.length) return base
  // уроки/боссы, которых больше нет в контенте, тихо выкидываем — план не должен ломать игру
  const weeks = renumber(override.weeks).map((w) => ({
    ...w,
    lessonIds: w.lessonIds.filter((id) => base.lessons[id]),
    bossId: w.bossId && base.bosses[w.bossId] ? w.bossId : undefined,
    negotiationId: w.negotiationId && base.negotiations[w.negotiationId] ? w.negotiationId : undefined,
  }))
  const keys = new Set(weeks.map(weekKey))
  return { ...base, weeks, missions: (override.missions ?? []).filter((m) => keys.has(m.weekKey)) }
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
    contract: { text: 'Реальное действие в кабинете Kaspi', proof: 'photo' },
  }
}
