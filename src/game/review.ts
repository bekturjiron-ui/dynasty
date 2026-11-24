import type { Exercise, Lesson } from '../content/schema'
import type { Progress } from '../db'

/** «Разбор утра»: один вопрос в день из уже пройденных уроков. Чаще достаются те, где игрок брал подсказки или ошибался.
 *  Хранится на этом телефоне (localStorage), в базу и бэкап не входит: это повторение, а не прогресс. */
const STATS_KEY = 'dynasty-review'
const DAY_KEY = 'dynasty-review-day'

export type ReviewStats = Record<string, { miss: number; ok: number }>
export type ReviewDay = { day: string; lessonId: string; misses: number }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* без памяти повторение просто не запомнится */ }
}

export const loadReviewStats = (): ReviewStats => read<ReviewStats>(STATS_KEY, {})

/** Результат сегодняшнего разбора, если он уже сделан. */
export function loadReviewToday(day: string): ReviewDay | null {
  const d = read<ReviewDay | null>(DAY_KEY, null)
  return d && d.day === day ? d : null
}

export function saveReviewResult(day: string, lessonId: string, misses: number) {
  write(DAY_KEY, { day, lessonId, misses } satisfies ReviewDay)
  const stats = loadReviewStats()
  const s = stats[lessonId] ?? { miss: 0, ok: 0 }
  stats[lessonId] = misses > 0 ? { ...s, miss: s.miss + 1 } : { ...s, ok: s.ok + 1 }
  write(STATS_KEY, stats)
}

/** Упражнение на выбор из урока: оно одинаково работает без чисел и таблиц. */
export const choiceOf = (l: Lesson): Exercise | undefined => [l.solo, l.guided].find((e) => e?.choice)

/** Детерминированный «случайный» выбор на день: до полуночи вопрос не меняется. */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function weightOf(p: Progress, s: { miss: number; ok: number } | undefined): number {
  const w = 1
    + (p.status === 'done_with_hints' ? 2 : 0)
    + Math.min(3, Math.max(0, p.attempts - 1)) * 0.7
    + Math.min(3, p.hintsUsed) * 0.3
    + (s?.miss ?? 0) * 2
    - (s?.ok ?? 0) * 0.5
  return Math.max(0.3, w)
}

export function pickReview(lessons: Record<string, Lesson>, progress: Map<string, Progress>, stats: ReviewStats, day: string): { lesson: Lesson; ex: Exercise } | null {
  const pool = [...progress.values()]
    .map((p) => ({ p, lesson: lessons[p.lessonId] }))
    .filter((x): x is { p: Progress; lesson: Lesson } => !!x.lesson && !!choiceOf(x.lesson))
    .sort((a, b) => a.p.lessonId.localeCompare(b.p.lessonId))
  if (pool.length === 0) return null
  const weights = pool.map((x) => weightOf(x.p, stats[x.p.lessonId]))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = seeded(day)() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return { lesson: pool[i].lesson, ex: choiceOf(pool[i].lesson)! }
  }
  const last = pool[pool.length - 1]
  return { lesson: last.lesson, ex: choiceOf(last.lesson)! }
}
