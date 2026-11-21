import { db, type ContractResult, type MissionResult } from '../db'
import { dayKey } from '../lib/dates'

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b) })

/** Полное состояние игры в JSON (фото контрактов — внутри как data URL). */
export async function exportState(): Promise<Blob> {
  const contracts = await Promise.all(
    (await db.contracts.toArray()).map(async (c) => ({ ...c, photo: c.photo ? await blobToDataUrl(c.photo) : undefined })),
  )
  const data = {
    app: 'dynasty',
    version: 1,
    exportedAt: new Date().toISOString(),
    player: await db.player.toArray(),
    progress: await db.progress.toArray(),
    bosses: await db.bosses.toArray(),
    contracts,
    activity: await db.activity.toArray(),
    settings: await db.settings.toArray(),
    reports: await db.reports.toArray(),
    negotiations: await db.negotiations.toArray(),
    buildings: await db.buildings.toArray(),
    plan: await db.plan.toArray(),
    missionResults: await Promise.all((await db.missionResults.toArray()).map(async (m) => ({ ...m, photo: m.photo ? await blobToDataUrl(m.photo) : undefined }))),
  }
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

export function downloadBlob(blob: Blob, name = `dynasty-backup-${dayKey()}.json`) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const TABLES = ['player', 'progress', 'bosses', 'contracts', 'activity', 'settings', 'reports', 'negotiations', 'buildings', 'plan', 'missionResults'] as const
const KEYS: Record<(typeof TABLES)[number], string> = { player: 'id', progress: 'lessonId', bosses: 'bossId', contracts: 'week', activity: 'day', settings: 'id', reports: 'week', negotiations: 'id', buildings: 'id', plan: 'id', missionResults: 'id' }

/** Проверка файла ДО очистки базы: версия, что таблицы — массивы объектов с ключом, и что игрок выглядит как игрок. */
function validateBackup(data: Record<string, unknown>) {
  if (data.version !== undefined && data.version !== 1) throw new Error('Бэкап сделан другой версией игры')
  for (const t of TABLES) {
    const rows = data[t]
    if (rows === undefined) continue
    if (!Array.isArray(rows)) throw new Error('Файл повреждён: таблица «' + t + '» не список')
    for (const r of rows) if (!r || typeof r !== 'object' || (r as Record<string, unknown>)[KEYS[t]] === undefined) throw new Error('Файл повреждён: в таблице «' + t + '» строка без ключа')
  }
  const players = (data.player ?? []) as Record<string, unknown>[]
  if (players.length > 1) throw new Error('Файл повреждён: игроков больше одного')
  for (const p of players) {
    if (p.id !== 'me' || typeof p.houseName !== 'string' || typeof p.rank !== 'number' || typeof p.capital !== 'number' || typeof p.xp !== 'number' || typeof p.startedAt !== 'string') throw new Error('Файл повреждён: данные игрока не читаются')
  }
}

/** Заменяет всё состояние содержимым бэкапа. */
export async function importState(file: File) {
  const data = JSON.parse(await file.text())
  if (data?.app !== 'dynasty') throw new Error('Это не бэкап «Династии»')
  validateBackup(data)
  const contracts: ContractResult[] = await Promise.all(
    (data.contracts ?? []).map(async (c: ContractResult & { photo?: string }) => ({
      ...c,
      photo: c.photo ? await (await fetch(c.photo)).blob() : undefined,
    })),
  )
  const missionResults: MissionResult[] = await Promise.all(
    (data.missionResults ?? []).map(async (m: MissionResult & { photo?: string }) => ({ ...m, photo: m.photo ? await (await fetch(m.photo)).blob() : undefined })),
  )
  await db.transaction('rw', [db.player, db.progress, db.bosses, db.contracts, db.activity, db.settings, db.reports, db.negotiations, db.buildings, db.plan, db.missionResults], async () => {
    await Promise.all([db.player.clear(), db.progress.clear(), db.bosses.clear(), db.contracts.clear(), db.activity.clear(), db.settings.clear(), db.reports.clear(), db.negotiations.clear(), db.buildings.clear(), db.plan.clear(), db.missionResults.clear()])
    await db.player.bulkPut(data.player ?? [])
    await db.progress.bulkPut(data.progress ?? [])
    await db.bosses.bulkPut(data.bosses ?? [])
    await db.contracts.bulkPut(contracts)
    await db.activity.bulkPut(data.activity ?? [])
    await db.settings.bulkPut(data.settings ?? [])
    await db.reports.bulkPut(data.reports ?? [])
    await db.negotiations.bulkPut(data.negotiations ?? [])
    await db.buildings.bulkPut(data.buildings ?? [])
    await db.plan.bulkPut(data.plan ?? [])
    await db.missionResults.bulkPut(missionResults)
  })
}
