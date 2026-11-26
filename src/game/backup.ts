import { db, type ContractResult, type MissionResult, type Settings } from '../db'
import { DEFAULT_SETTINGS } from '../defaults'
import { dayKey } from '../lib/dates'

/** 2 — курс по таргетингу. Бэкапы старого курса несовместимы: другие уроки, недели и настройки. */
const BACKUP_VERSION = 2

export const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b) })

/** Полное состояние игры в JSON (фото контрактов — внутри как data URL). */
export async function exportState(): Promise<Blob> {
  const contracts = await Promise.all(
    (await db.contracts.toArray()).map(async (c) => ({ ...c, photo: c.photo ? await blobToDataUrl(c.photo) : undefined })),
  )
  const data = {
    app: 'dynasty',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    player: await db.player.toArray(),
    progress: await db.progress.toArray(),
    bosses: await db.bosses.toArray(),
    contracts,
    activity: await db.activity.toArray(),
    // PIN наставника в файл не кладём: бэкап читает и ученик
    settings: (await db.settings.toArray()).map(({ mentorPin: _pin, ...s }) => s),
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

/** Встроенный файл без параметров типа: так его пишет exportState (у файла с телефона тип бывает пустым — тогда octet-stream). */
const PHOTO_DATA_URL = /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]*$/i

/** Проверка файла ДО очистки базы: версия, что таблицы — массивы объектов с ключом, и что игрок выглядит как игрок. */
function validateBackup(data: Record<string, unknown>) {
  if (data.version !== BACKUP_VERSION) throw new Error('Этот бэкап сделан для прошлого курса и сюда не подходит')
  for (const t of TABLES) {
    const rows = data[t]
    if (rows === undefined) continue
    if (!Array.isArray(rows)) throw new Error('Файл повреждён: таблица «' + t + '» не список')
    for (const r of rows) if (!r || typeof r !== 'object' || (r as Record<string, unknown>)[KEYS[t]] === undefined) throw new Error('Файл повреждён: в таблице «' + t + '» строка без ключа')
  }
  // Фото — только встроенные картинки. Ссылка на сайт означала бы сетевой запрос при импорте и чужой тип файла в кейсе
  for (const t of ['contracts', 'missionResults'] as const) {
    for (const r of (data[t] ?? []) as Record<string, unknown>[]) {
      if (r.photo !== undefined && r.photo !== null && (typeof r.photo !== 'string' || !PHOTO_DATA_URL.test(r.photo))) throw new Error('Файл повреждён: фото в таблице «' + t + '» не картинка')
    }
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
    // PIN этого устройства переживает импорт; PIN из старых бэкапов, где он ещё был, не подменяет текущий
    const pin = (await db.settings.get('main'))?.mentorPin ?? DEFAULT_SETTINGS.mentorPin
    const settings = ((data.settings ?? []) as Settings[]).map((s) => ({ ...DEFAULT_SETTINGS, ...s, mentorPin: pin }))
    await Promise.all([db.player.clear(), db.progress.clear(), db.bosses.clear(), db.contracts.clear(), db.activity.clear(), db.settings.clear(), db.reports.clear(), db.negotiations.clear(), db.buildings.clear(), db.plan.clear(), db.missionResults.clear()])
    await db.player.bulkPut(data.player ?? [])
    await db.progress.bulkPut(data.progress ?? [])
    await db.bosses.bulkPut(data.bosses ?? [])
    await db.contracts.bulkPut(contracts)
    await db.activity.bulkPut(data.activity ?? [])
    await db.settings.bulkPut(settings)
    await db.reports.bulkPut(data.reports ?? [])
    await db.negotiations.bulkPut(data.negotiations ?? [])
    await db.buildings.bulkPut(data.buildings ?? [])
    await db.plan.bulkPut(data.plan ?? [])
    await db.missionResults.bulkPut(missionResults)
  })
}
