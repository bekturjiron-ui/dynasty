import type { ArsenalSkill, Content } from '../content/schema'
import { weekStatus, type State, type WeekStatus } from './engine'

export const GROUPS: Record<ArsenalSkill['group'], { label: string; text: string; tint: string; ring: string }> = {
  data: { label: 'Данные', text: 'text-xp', tint: 'bg-xp/15', ring: '#5aa9f0' },
  kaspi: { label: 'Kaspi', text: 'text-gold-soft', tint: 'bg-gold/15', ring: '#e0b84e' },
  money: { label: 'Деньги', text: 'text-emerald', tint: 'bg-emerald/15', ring: '#52b890' },
  people: { label: 'Люди', text: 'text-rep', tint: 'bg-rep/15', ring: '#a77bd2' },
}
export const LEVEL_NAMES = ['Не начат', 'Новичок', 'Практик', 'Мастер']

export type SkillState = {
  statuses: WeekStatus[]
  done: number
  total: number
  ratio: number
  /** 0 — не начат, 1 — есть пройденные уроки, 2 — не меньше половины уроков, 3 — все недели навыка закрыты */
  level: 0 | 1 | 2 | 3
  firstWeek?: number
}

/** Прогресс навыка по урокам, боссам и контрактам его недель. */
export function skillState(skill: ArsenalSkill, content: Content, st: State): SkillState {
  const weeks = skill.weeks.map((k) => content.weeks.find((w) => (w.key ?? w.n) === k)).filter((w): w is NonNullable<typeof w> => !!w)
  const statuses = weeks.map((w) => weekStatus(w, content, st))
  const done = statuses.reduce((s, x) => s + x.lessonsDone, 0)
  const total = statuses.reduce((s, x) => s + x.lessonsTotal, 0)
  const complete = total > 0 && statuses.every((x) => x.complete)
  const level = !total || !done ? 0 : complete ? 3 : done / total >= 0.5 ? 2 : 1
  return { statuses, done, total, ratio: total ? done / total : 0, level, firstWeek: weeks[0]?.n }
}
