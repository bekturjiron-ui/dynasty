import { content } from '../content'
import { db } from '../db'
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

/** Полный сброс: игрок, прогресс, постройки, настройки, план, импорт Kaspi. После него игра начинается с экрана основания Дома. */
export async function resetAll() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })
}
