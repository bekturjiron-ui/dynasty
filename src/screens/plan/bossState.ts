import type { BossState } from '../../components/BossToken'
import type { WeekStatus } from '../../game/engine'
import type { Game } from '../../game/useGame'

/** Состояние босса недели: общее для карты и окна недели. */
export function bossState(s: WeekStatus, game: Game): BossState {
  const w = s.week
  // Переговоры закрыты до конца уроков, даже если диалог уже успели сыграть
  if (w.negotiationId && game.content.negotiations[w.negotiationId]) return !s.bossUnlocked ? 'locked' : game.negotiations.has(w.negotiationId) ? 'done' : 'ready'
  if (s.bossReady) return s.bossDone ? 'done' : s.bossUnlocked ? 'ready' : 'locked'
  return 'locked'
}
