import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_SETTINGS } from './defaults'
import type { Filter, Row } from './game/importKaspi'
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

/** packPct — упаковка в % от цены; в старых сохранениях может отсутствовать */
export type Settings = { id: 'main'; kaspiFeePct: number; deliveryCost: number; taxPct: number; packPct?: number; mentorPin: string }

export type WeeklyReport = {
  week: number
  revenue: number
  orders: number
  reviews: number
  adSpend: number
  /** Маржа недели, в долях (0.12 = 12%) */
  margin?: number
  note?: string
  at?: string
}

export { DEFAULT_SETTINGS }

/** Импорт архива заказов Kaspi. В rows — только товар, дата, сумма, количество, статус, доставка, категория. */
export type KaspiImport = {
  id: 'kaspi'
  at: string
  fileName: string
  rows: Row[]
  filter: Filter
  /** Что из архива подставлять в уроки с useRealData */
  apply: { price: boolean; orders: boolean; delivery: boolean }
}

/** Правки плана наставником (и порядок уроков игроком). Нет записи — действует content/plan.json. */
export type PlanOverride = { id: 'main'; weeks: Week[]; missions: Mission[]; updatedAt: string }

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
  imports!: EntityTable<KaspiImport, 'id'>
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
    // v4: импорт архива Kaspi (только обезличенные строки)
    this.version(4).stores({ imports: 'id' })
    // v5: план наставника и свои миссии
    this.version(5).stores({ plan: 'id', missionResults: 'id' })
  }
}

export const db = new DynastyDB()

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('main')) ?? DEFAULT_SETTINGS
}
