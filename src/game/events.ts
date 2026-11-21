// Простая шина событий для церемонии повышения ранга.
export type RankUp = { rank: number; title: string }
type Listener = (e: RankUp) => void
const listeners = new Set<Listener>()
// Последнее непоказанное повышение: окно церемонии может перемонтироваться (например, пока обновляется состояние игры),
// и тогда событие не должно теряться.
let unseen: RankUp | null = null

export function onRankUp(fn: Listener) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
export function emitRankUp(e: RankUp) {
  unseen = e
  listeners.forEach((fn) => fn(e))
}
/** Непоказанное повышение (если есть) — для окна, которое только что появилось. */
export const peekRankUp = () => unseen
export const clearRankUp = () => { unseen = null }
