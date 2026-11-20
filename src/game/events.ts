// Простая шина событий для церемонии повышения ранга.
export type RankUp = { rank: number; title: string }
type Listener = (e: RankUp) => void
const listeners = new Set<Listener>()

export function onRankUp(fn: Listener) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
export function emitRankUp(e: RankUp) {
  listeners.forEach((fn) => fn(e))
}
