// Игровая логика: серия со щитом, текущая неделя, статусы, награды и повышение ранга.
import { DEFAULT_SETTINGS } from '../defaults'
import { db, type BossResult, type ContractResult, type MissionResult, type NegotiationResult, type Player, type Progress, type WeeklyReport } from '../db'
import { addDays, dayKey, daysBetween, weekStart } from '../lib/dates'
import type { Content, Mission, Week } from '../content/schema'
import { emitRankUp } from './events'

export const TOTAL_WEEKS = 24
export const CONTRACT_REWARD = { capital: 500, xp: 200 }

// ---------- Серия дней со щитом ----------
export type StreakInfo = { streak: number; shieldUsedThisWeek: boolean; activeToday: boolean; lastDay?: string; daysAway: number }

/** Серия: сегодня ещё не сыграл — серия не рвётся. Один пропуск в календарную неделю закрывает «щит». */
export function computeStreak(days: string[], today = dayKey()): StreakInfo {
  const set = new Set(days)
  const sorted = [...days].sort()
  const first = sorted[0]
  const lastDay = sorted[sorted.length - 1]
  const activeToday = set.has(today)
  const daysAway = lastDay ? daysBetween(lastDay, today) : 0
  if (!first) return { streak: 0, shieldUsedThisWeek: false, activeToday, daysAway }

  let streak = 0
  let d = activeToday ? today : addDays(today, -1)
  const shields = new Set<string>()
  while (d >= first) {
    if (set.has(d)) { streak++; d = addDays(d, -1); continue }
    const wk = weekStart(d)
    if (!shields.has(wk)) { shields.add(wk); d = addDays(d, -1); continue }
    break
  }
  return { streak, shieldUsedThisWeek: shields.has(weekStart(today)), activeToday, lastDay, daysAway }
}

// ---------- Неделя плана ----------
export function currentWeek(p: Player, today = dayKey(), total = TOTAL_WEEKS): number {
  const w = Math.floor(daysBetween(p.startedAt, today) / 7) + 1 - (p.planOffsetWeeks ?? 0)
  return Math.min(Math.max(w, 1), total)
}

export type State = {
  progress: Map<string, Progress>
  bosses: Map<string, BossResult>
  contracts: Map<number, ContractResult>
  missions: Map<string, MissionResult>
}

export type WeekStatus = {
  week: Week
  lessonsDone: number
  lessonsTotal: number
  nextLessonId?: string
  bossReady: boolean // контент босса есть
  bossDone: boolean
  bossUnlocked: boolean // уроки недели пройдены
  contractDone: boolean
  missions: Mission[]
  missionsDone: number
  complete: boolean
  hasContent: boolean
}

export function weekStatus(week: Week, content: Content, st: State): WeekStatus {
  const ids = week.lessonIds.filter((id) => content.lessons[id])
  const done = ids.filter((id) => st.progress.has(id))
  const bossReady = !!(week.bossId && content.bosses[week.bossId])
  const bossDone = bossReady && st.bosses.has(week.bossId!)
  const contractDone = st.contracts.has(week.key ?? week.n)
  const missions = content.missions.filter((m) => m.weekKey === (week.key ?? week.n))
  const missionsDone = missions.filter((m) => st.missions.has(m.id)).length
  const lessonsComplete = done.length === ids.length
  return {
    week,
    lessonsDone: done.length,
    lessonsTotal: ids.length,
    nextLessonId: ids.find((id) => !st.progress.has(id)),
    bossReady,
    bossDone,
    bossUnlocked: lessonsComplete,
    contractDone,
    missions,
    missionsDone,
    complete: lessonsComplete && (!bossReady || bossDone) && contractDone && missionsDone === missions.length,
    hasContent: ids.length > 0 || bossReady || missions.length > 0,
  }
}

/** Неделя, над которой игрок работает: самая ранняя незакрытая неделя с контентом не позже текущей,
 *  иначе — текущая (или следующая с контентом, если всё закрыто — «на опережение»). */
export function focusWeek(content: Content, st: State, now: number): WeekStatus {
  const statuses = content.weeks.map((w) => weekStatus(w, content, st))
  const behind = statuses.find((s) => s.week.n <= now && !s.complete && (s.hasContent || s.week.n === now))
  if (behind) return behind
  const ahead = statuses.find((s) => s.week.n > now && !s.complete && s.hasContent)
  return ahead ?? statuses.find((s) => s.week.n === now) ?? statuses[0]
}

// ---------- Ранги ----------
export function rankProgress(content: Content, player: Player, st: State) {
  const rank = content.ranks.find((r) => r.n === player.rank) ?? content.ranks[0]
  const next = content.ranks.find((r) => r.n === player.rank + 1)
  const need = rank?.promoteWhen.contracts ?? []
  const have = need.filter((w) => st.contracts.has(w)).length
  return { rank, next, need, have, ratio: need.length ? have / need.length : 1 }
}

async function loadState(): Promise<State> {
  const [progress, bosses, contracts, missions] = await Promise.all([db.progress.toArray(), db.bosses.toArray(), db.contracts.toArray(), db.missionResults.toArray()])
  return {
    progress: new Map(progress.map((p) => [p.lessonId, p])),
    bosses: new Map(bosses.map((b) => [b.bossId, b])),
    contracts: new Map(contracts.map((c) => [c.week, c])),
    missions: new Map(missions.map((m) => [m.id, m])),
  }
}

/** Начисляет награду, отмечает активность дня и проверяет повышение ранга. */
async function award(content: Content, gain: { capital?: number; xp?: number; influence?: number; reputation?: number }) {
  const today = dayKey()
  const p = await db.player.get('me')
  if (!p) return
  const updated: Player = {
    ...p,
    capital: p.capital + (gain.capital ?? 0),
    xp: p.xp + (gain.xp ?? 0),
    influence: p.influence + (gain.influence ?? 0),
    reputation: Math.max(0, Math.min(100, p.reputation + (gain.reputation ?? 0))),
  }
  const act = await db.activity.get(today)
  await db.activity.put({ day: today, xp: (act?.xp ?? 0) + (gain.xp ?? 0), actions: (act?.actions ?? 0) + 1 })

  // Повышение: условие текущего ранга выполнено → следующий титул (может быть несколько подряд)
  const st = await loadState()
  const before = updated.rank
  for (;;) {
    const r = content.ranks.find((x) => x.n === updated.rank)
    const next = content.ranks.find((x) => x.n === updated.rank + 1)
    if (!r || !next || r.promoteWhen.contracts.length === 0) break
    if (!r.promoteWhen.contracts.every((w) => st.contracts.has(w))) break
    updated.rank = next.n
  }
  await db.player.put(updated)
  if (updated.rank > before) {
    const r = content.ranks.find((x) => x.n === updated.rank)!
    emitRankUp({ rank: r.n, title: r.title })
  }
}

/** Урок решён. Первый раз — полная награда (половина Капитала, если были подсказки).
 *  Повтор без подсказок после «с подсказками» — доплачивает вторую половину. Повтор засчитывается в серию. */
export async function completeLesson(content: Content, lessonId: string, hintsUsed: number, attempts: number) {
  const lesson = content.lessons[lessonId]
  if (!lesson) return { capital: 0, xp: 0 }
  const prev = await db.progress.get(lessonId)
  const status: Progress['status'] = hintsUsed > 0 ? 'done_with_hints' : 'done'
  const full = lesson.reward.capital
  const half = Math.round(full / 2)
  let gain = { capital: 0, xp: 0 }
  if (!prev) gain = { capital: status === 'done' ? full : half, xp: lesson.reward.xp }
  else if (prev.status === 'done_with_hints' && status === 'done') gain = { capital: full - half, xp: 0 }
  await db.progress.put({
    lessonId,
    status: prev?.status === 'done' ? 'done' : status,
    at: new Date().toISOString(),
    attempts: (prev?.attempts ?? 0) + attempts,
    hintsUsed: Math.min(prev?.hintsUsed ?? Infinity, hintsUsed),
  })
  await award(content, gain)
  return gain
}

export async function completeBoss(content: Content, bossId: string, attempts: number, livesLeft: number) {
  const boss = content.bosses[bossId]
  if (!boss) return { capital: 0, xp: 0 }
  const prev = await db.bosses.get(bossId)
  const gain = prev ? { capital: 0, xp: 0 } : boss.reward
  if (!prev) await db.bosses.put({ bossId, week: boss.week, at: new Date().toISOString(), attempts, livesLeft })
  await award(content, gain)
  return gain
}

/** week — постоянный ключ недели (Week.key), не позиция в плане. */
export async function completeContract(content: Content, week: number, proof: ContractResult['proof'], data: { value?: number; photo?: Blob }) {
  const prev = await db.contracts.get(week)
  await db.contracts.put({ week, at: new Date().toISOString(), proof, ...data })
  const gain = prev ? { capital: 0, xp: 0 } : CONTRACT_REWARD
  await award(content, gain)
  return gain
}

/** Переговоры завершены. XP — один раз и только за сделку; Влияние и Репутация — по качеству отношений.
 *  Повтор с лучшей экономией обновляет рекорд, но награду не удваивает. */
export async function completeNegotiation(
  content: Content,
  id: string,
  r: { end: NegotiationResult['end']; discount: number; loyalty: number; saving: number; xp: boolean; influence: number; reputation: number },
) {
  const n = content.negotiations[id]
  if (!n) return { xp: 0, influence: 0, reputation: 0 }
  const prev = await db.negotiations.get(id)
  const firstDeal = r.xp && !prev?.rewarded
  const better = !prev || r.saving > prev.saving
  await db.negotiations.put({
    id,
    at: new Date().toISOString(),
    end: better ? r.end : prev!.end,
    discount: better ? r.discount : prev!.discount,
    loyalty: better ? r.loyalty : prev!.loyalty,
    saving: better ? r.saving : prev!.saving,
    runs: (prev?.runs ?? 0) + 1,
    rewarded: prev?.rewarded || firstDeal,
  })
  // Репутация меняется всегда: как ты ведёшь себя с партнёрами — запоминается
  const gain = { xp: firstDeal ? n.reward.xp : 0, influence: firstDeal ? r.influence : 0, reputation: r.reputation }
  await award(content, gain)
  return gain
}

// ---------- План наставника ----------
/** Сохранить правки плана (наставник или порядок уроков игроком). */
export async function savePlan(weeks: Week[], missions: Mission[], baseWeeks: Week[]) {
  await db.plan.put({ id: 'main', weeks: weeks.map((w, i) => ({ ...w, key: w.key ?? w.n, n: i + 1 })), missions, baseWeeks, updatedAt: new Date().toISOString() })
}
export async function resetPlan() {
  await db.plan.delete('main')
}
/** «Растянуть план на N недель»: сдвигает текущую неделю, дедлайны и график соперника. */
export async function setPlanOffset(weeks: number) {
  const p = await db.player.get('me')
  if (p) await db.player.put({ ...p, planOffsetWeeks: Math.max(0, Math.min(24, Math.round(weeks))) })
}
export async function setMentorPin(pin: string) {
  const s = (await db.settings.get('main')) ?? { ...DEFAULT_SETTINGS }
  await db.settings.put({ ...s, mentorPin: pin })
}

/** Своя миссия наставника: награда — один раз. */
export async function completeMission(content: Content, m: Mission, data: { value?: number; photo?: Blob }) {
  const prev = await db.missionResults.get(m.id)
  await db.missionResults.put({ id: m.id, at: new Date().toISOString(), ...data })
  const gain = prev ? { xp: 0, capital: 0 } : m.reward
  await award(content, gain)
  return gain
}

export const REPORT_REWARD = { xp: 40 }

/** Совет Дома: недельные цифры Novelia. XP — один раз за неделю плана; исправить цифры можно без награды. */
export async function saveWeeklyReport(content: Content, r: WeeklyReport) {
  const prev = await db.reports.get(r.week)
  await db.reports.put({ ...r, at: new Date().toISOString() })
  const gain = prev ? { xp: 0 } : REPORT_REWARD
  if (!prev) await award(content, gain)
  return gain
}

export type BuyResult = { ok: true } | { ok: false; reason: 'owned' | 'rank' | 'capital' | 'missing' }

/** Покупка постройки: нужен и титул, и Капитал. Списание и запись — одной транзакцией.
 *  Активностью дня не считается: это трата, а не проверяемый результат. */
export async function buyBuilding(content: Content, id: string): Promise<BuyResult> {
  const b = content.empire.buildings.find((x) => x.id === id)
  if (!b) return { ok: false, reason: 'missing' }
  return db.transaction('rw', db.player, db.buildings, async () => {
    const p = await db.player.get('me')
    if (!p) return { ok: false, reason: 'missing' } as const
    if (b.cost === 0 || (await db.buildings.get(id))) return { ok: false, reason: 'owned' } as const
    if (p.rank < b.minRank) return { ok: false, reason: 'rank' } as const
    if (p.capital < b.cost) return { ok: false, reason: 'capital' } as const
    await db.player.put({ ...p, capital: p.capital - b.cost })
    await db.buildings.put({ id, at: new Date().toISOString(), paid: b.cost })
    return { ok: true } as const
  })
}

export async function foundHouse(houseName: string) {
  await db.player.put({
    id: 'me',
    houseName: houseName.trim() || 'Мой Дом',
    rank: 1,
    xp: 0,
    capital: 0,
    influence: 0,
    reputation: 50,
    startedAt: dayKey(),
    planOffsetWeeks: 0,
  })
}
