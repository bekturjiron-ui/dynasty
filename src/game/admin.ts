import { content } from '../content'
import { db } from '../db'
import { dayKey } from '../lib/dates'
import { emitRankUp } from './events'

/** Админ-панель: только для проверки того, как игра меняется. Работает с локальной базой этого устройства. */
export const ADMIN_PIN = '000'

export async function adjustPlayer(d: { capital?: number; xp?: number; influence?: number; reputation?: number }) {
  const p = await db.player.get('me')
  if (!p) return
  await db.player.put({
    ...p,
    capital: Math.max(0, p.capital + (d.capital ?? 0)),
    xp: Math.max(0, p.xp + (d.xp ?? 0)),
    influence: Math.max(0, p.influence + (d.influence ?? 0)),
    reputation: Math.max(0, Math.min(100, p.reputation + (d.reputation ?? 0))),
  })
}

/** Ставит титул. С церемонией — показывает окно нового титула, как при настоящем повышении. */
export async function setRank(rank: number, ceremony: boolean) {
  const p = await db.player.get('me')
  const r = content.ranks.find((x) => x.n === rank)
  if (!p || !r) return
  await db.player.put({ ...p, rank })
  if (ceremony) emitRankUp({ rank, title: r.title })
}

/** Показать церемонию, ничего не меняя в игре. */
export function previewCeremony(rank: number) {
  const r = content.ranks.find((x) => x.n === rank)
  if (r) emitRankUp({ rank, title: r.title })
}

export async function setAllBuildings(owned: boolean) {
  await db.transaction('rw', db.buildings, async () => {
    await db.buildings.clear()
    if (owned) for (const b of content.empire.buildings.filter((x) => x.cost > 0)) await db.buildings.put({ id: b.id, at: new Date().toISOString(), paid: 0 })
  })
}

/** Отмечает пройденными все уроки (и при withBosses — боссов и переговоры), чтобы проверить закрытые недели. Награды не начисляются. */
export async function completeAllProgress(withBosses: boolean) {
  const at = new Date().toISOString()
  await db.transaction('rw', [db.progress, db.bosses, db.negotiations], async () => {
    for (const lessonId of Object.keys(content.lessons)) {
      if (!(await db.progress.get(lessonId))) await db.progress.put({ lessonId, status: 'done', at, attempts: 1, hintsUsed: 0 })
    }
    if (!withBosses) return
    for (const w of content.weeks) {
      if (w.bossId && content.bosses[w.bossId] && !(await db.bosses.get(w.bossId))) await db.bosses.put({ bossId: w.bossId, week: w.key ?? w.n, at, attempts: 1, livesLeft: 3 })
      if (w.negotiationId && content.negotiations[w.negotiationId] && !(await db.negotiations.get(w.negotiationId))) {
        await db.negotiations.put({ id: w.negotiationId, at, end: 'deal', discount: 0, loyalty: 50, saving: 0, runs: 1, rewarded: true })
      }
    }
  })
}

/** Снимает прохождение уроков, боссов и переговоров: недели снова закрываются по порядку. Ресурсы и титулы не трогает. */
export async function clearAllProgress() {
  await db.transaction('rw', [db.progress, db.bosses, db.negotiations], async () => {
    await Promise.all([db.progress.clear(), db.bosses.clear(), db.negotiations.clear()])
  })
}

/** Полный сброс: игрок, прогресс, постройки, настройки, план. После него игра начинается с экрана основания Дома. */
export async function resetAll() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })
}

/** Рестарт для игрока: прогресс, титулы, постройки и ресурсы с нуля. Настройки (бриф проекта, PIN) и правки плана наставника остаются,
 *  имя Дома тоже. Дата начала ставится заново. */
export async function restartGame() {
  await db.transaction('rw', [db.player, db.progress, db.bosses, db.contracts, db.activity, db.reports, db.negotiations, db.buildings, db.missionResults], async () => {
    const p = await db.player.get('me')
    await Promise.all([db.progress.clear(), db.bosses.clear(), db.contracts.clear(), db.activity.clear(), db.reports.clear(), db.negotiations.clear(), db.buildings.clear(), db.missionResults.clear()])
    await db.player.put({
      id: 'me',
      houseName: p?.houseName ?? 'Мой Дом',
      rank: 1,
      xp: 0,
      capital: 0,
      influence: 0,
      reputation: 50,
      startedAt: dayKey(),
      planOffsetWeeks: 0,
    })
  })
}
