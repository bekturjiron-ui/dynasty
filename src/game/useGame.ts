import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, DEFAULT_SETTINGS, type Settings } from '../db'
import { content } from '../content'
import { baseScope } from '../content/scope'
import { computeStreak, currentWeek, focusWeek, rankProgress, type State } from './engine'
import { applyFilter, applyOverrides, overridesFrom } from './importKaspi'
import { effectiveContent } from './plan'

/** Всё живое состояние игры из IndexedDB, пересчитывается при каждом изменении. */
export function useGame() {
  const data = useLiveQuery(async () => {
    const [player, settings, progress, bosses, contracts, activity, negotiations, buildings, reports, kaspi, plan, missionResults] = await Promise.all([
      db.player.get('me'),
      db.settings.get('main'),
      db.progress.toArray(),
      db.bosses.toArray(),
      db.contracts.toArray(),
      db.activity.toArray(),
      db.negotiations.toArray(),
      db.buildings.toArray(),
      db.reports.toArray(),
      db.imports.get('kaspi'),
      db.plan.get('main'),
      db.missionResults.toArray(),
    ])
    return { player, settings: settings ?? DEFAULT_SETTINGS, progress, bosses, contracts, activity, negotiations, buildings, reports, kaspi, plan, missionResults }
  })

  return useMemo(() => {
    if (!data) return { loading: true as const }
    const st: State = {
      progress: new Map(data.progress.map((p) => [p.lessonId, p])),
      bosses: new Map(data.bosses.map((b) => [b.bossId, b])),
      contracts: new Map(data.contracts.map((c) => [c.week, c])),
      missions: new Map(data.missionResults.map((m) => [m.id, m])),
      negotiations: new Map(data.negotiations.map((x) => [x.id, x])),
    }
    // план с правками наставника поверх content/plan.json
    const eff = effectiveContent(content, data.plan)
    const settings: Settings = data.settings
    const scope = baseScope(content.products, settings)
    // Уроки с useRealData берут продажи (и, если включено, цены/доставку) из импорта архива Kaspi
    const kaspi = data.kaspi
    const kept = kaspi ? applyFilter(kaspi.rows, kaspi.filter) : []
    const overrides = kaspi ? overridesFrom(kept, content.products) : []
    const scopeReal = kaspi && overrides.length ? baseScope(applyOverrides(content.products, overrides, kaspi.apply), settings) : scope
    const streak = computeStreak(data.activity.map((a) => a.day))
    const player = data.player
    const now = player ? currentWeek(player, undefined, eff.weeks.length) : 1
    return {
      loading: false as const,
      content: eff,
      planOverride: data.plan,
      player,
      settings,
      st,
      negotiations: new Map(data.negotiations.map((x) => [x.id, x])),
      buildings: new Set(data.buildings.map((x) => x.id)),
      activity: data.activity,
      reports: [...data.reports].sort((a, b) => a.week - b.week),
      kaspi,
      kaspiRows: kept,
      overrides,
      scope,
      scopeReal,
      streak,
      weekNow: now,
      focus: player ? focusWeek(eff, st, now) : undefined,
      rank: player ? rankProgress(eff, player, st) : undefined,
    }
  }, [data])
}

export type Game = Exclude<ReturnType<typeof useGame>, { loading: true }>
