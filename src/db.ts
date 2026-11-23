import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_SETTINGS } from './defaults'
import type { Mission, Week } from './content/schema'

export type Player = {
  id: 'me'
  houseName: string
  rank: number
  xp: number
  capital: number
  influence: number
  reputation: number
  startedAt: string // YYYY-MM-DD
  planOffsetWeeks: number
}

export type Progress = {
  lessonId: string
  status: 'done' | 'done_with_hints'
  at: string
  attempts: number
  hintsUsed: number
}

export type BossResult = { bossId: string; week: number; at: string; attempts: number; livesLeft: number }

export type ContractResult = {
  week: number
  at: string
  proof: 'checkbox' | 'number' | 'photo'
  value?: number
  photo?: Blob
}

/** День, когда игрок сделал хотя бы одно проверяемое действие — для серии. */
export type Activity = { day: string; xp: number; actions: number }

/** Бриф своего проекта: из него Совет считает потолки цены клиента, заявки и клика. */
export type ProjectBrief = { name: string; niche: string; avgCheck: number; marginPct: number; clickToLeadPct: number; leadToSalePct: number; targetCacPct: number }
export type Settings = { id: 'main'; mentorPin: string; project: ProjectBrief }

/** Цифры рекламной кампании за неделю плана. */
export type WeeklyReport = {
  week: number
  spend: number
  impressions: number
  reach: number
  clicks: number
  leads: number
  sales: number
  revenue: number
  note?: string
  at?: string
}

export { DEFAULT_SETTINGS }

/** Правки плана наставником (и порядок уроков игроком). Нет записи — действует content/plan.json. */
export type PlanOverride = {
  id: 'main'
  weeks: Week[]
  missions: Mission[]
  updatedAt: string
  /** Базовый план на момент сохранения: по нему видно, что правил человек, а что обновилось в новой версии игры. */
  baseWeeks?: Week[]
  /** Базовые миссии на момент сохранения: новые миссии из обновления игры не должны теряться. */
  baseMissionIds?: string[]
}

/** Выполненная своя миссия. */
export type MissionResult = { id: string; at: string; value?: number; photo?: Blob }

/** Постройка Империи, купленная за Капитал. */
export type OwnedBuilding = { id: string; at: string; paid: number }

/** Лучший результат переговоров (по экономии) и число попыток. */
export type NegotiationResult = {
  id: string
  at: string
  end: 'deal' | 'walk' | 'walkout' | 'left'
  discount: number
  loyalty: number
  saving: number
  runs: number
  /** XP и Влияние уже выданы (за первую сделку с сохранёнными отношениями) */
  rewarded?: boolean
}

class DynastyDB extends Dexie {
  player!: EntityTable<Player, 'id'>
  progress!: EntityTable<Progress, 'lessonId'>
  bosses!: EntityTable<BossResult, 'bossId'>
  contracts!: EntityTable<ContractResult, 'week'>
  activity!: EntityTable<Activity, 'day'>
  settings!: EntityTable<Settings, 'id'>
  reports!: EntityTable<WeeklyReport, 'week'>
  negotiations!: EntityTable<NegotiationResult, 'id'>
  buildings!: EntityTable<OwnedBuilding, 'id'>
  plan!: EntityTable<PlanOverride, 'id'>
  missionResults!: EntityTable<MissionResult, 'id'>

  constructor() {
    super('dynasty')
    this.version(1).stores({
      player: 'id',
      progress: 'lessonId',
      bosses: 'bossId',
      contracts: 'week',
      activity: 'day',
      settings: 'id',
      reports: 'week',
    })
    // v2: результаты переговоров
    this.version(2).stores({ negotiations: 'id' })
    // v3: постройки Империи
    this.version(3).stores({ buildings: 'id' })
    // v4: импорт архива (таблица удалена в v6)
    this.version(4).stores({ imports: 'id' })
    // v5: план наставника и свои миссии
    this.version(5).stores({ plan: 'id', missionResults: 'id' })
    // v6: новый курс по таргетингу. Старые уроки, недели и настройки несовместимы: полный сброс один раз.
    this.version(6).stores({ imports: null }).upgrade(async (tx) => {
      for (const t of ['player', 'progress', 'bosses', 'contracts', 'activity', 'settings', 'reports', 'negotiations', 'buildings', 'plan', 'missionResults']) await tx.table(t).clear()
    })
  }
}

export const db = new DynastyDB()

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('main')) ?? DEFAULT_SETTINGS
}
