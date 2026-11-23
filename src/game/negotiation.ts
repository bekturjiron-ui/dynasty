// Движок переговоров: чистые функции, без React и базы — их же гоняет валидатор.
import type { Negotiation, NegOption } from '../content/schema'
import { evalNum, type Scope } from '../lib/expr'
import { withVars } from '../content/scope'

export type NegEnd = 'deal' | 'walk' | 'walkout' | 'left'

export type NegState = {
  node: string
  /** Набранная скидка, % (не больше скрытого потолка) */
  discount: number
  loyalty: number
  patience: number
  /** Сколько ходов подряд лояльность ниже порога */
  cold: number
  moves: number
  /** Сколько скидки «сгорело» о потолок — давили впустую */
  wasted: number
  pressure: number
  end?: NegEnd
}

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))

/** Через сколько ходов похолодания партнёр уходит («через 2 хода» после первого предупреждения). */
export const COLD_LIMIT = 3

export function startNeg(n: Negotiation): NegState {
  return { node: n.start, discount: 0, loyalty: n.loyalty, patience: n.patience, cold: n.loyalty < n.coldBelow ? 1 : 0, moves: 0, wasted: 0, pressure: 0 }
}

export function choose(n: Negotiation, st: NegState, opt: NegOption): NegState {
  if (st.end) return st
  const raw = st.discount + opt.effect.price
  const discount = clamp(raw, 0, n.maxDiscountPct)
  const s: NegState = {
    ...st,
    discount,
    wasted: st.wasted + Math.max(0, raw - n.maxDiscountPct),
    loyalty: clamp(st.loyalty + opt.effect.loyalty),
    patience: clamp(st.patience + opt.effect.patience),
    moves: st.moves + 1,
    pressure: st.pressure + (opt.tactic === 'pressure' ? 1 : 0),
  }
  s.cold = s.loyalty < n.coldBelow ? st.cold + 1 : 0
  if (opt.next === '$deal') return { ...s, end: 'deal' }
  if (opt.next === '$walk') return { ...s, end: 'walk' }
  if (s.cold >= COLD_LIMIT) return { ...s, end: 'left' }
  if (s.patience <= 0) return { ...s, end: 'walkout' }
  return { ...s, node: opt.next }
}

/** Контекст шаблонов: базовый + переменные переговоров + текущее состояние. */
export function negScope(n: Negotiation, base: Scope, st?: NegState): Scope {
  const sc = withVars(base, n.vars)
  const start = typeof n.startPrice === 'number' ? n.startPrice : evalNum(n.startPrice, sc)
  const discount = st?.discount ?? 0
  return {
    ...sc,
    start,
    volume: n.volume,
    discount: discount / 100,
    price: Math.round(start * (1 - discount / 100)),
  }
}

export type NegOrder = { n: number; unit: number; note: string }
export type NegOutcome = {
  start: number
  dealUnit?: number
  orders: NegOrder[]
  /** Экономия за все размещения против стартовой цены, ₸ (может быть минус) */
  saving: number
  /** Сколько можно было сэкономить: потолок скидки при сохранённых отношениях */
  bestSaving: number
  reputation: number
  influence: number
  xp: boolean
  verdict: string
}

/** Итог: что сделка даст Дому за несколько размещений. Низкая лояльность — скидка только на первое. */
export function outcome(n: Negotiation, st: NegState, base: Scope): NegOutcome {
  const sc = negScope(n, base, st)
  const start = sc.start as number
  const deal = Math.round(start * (1 - st.discount / 100))
  const replacement = Math.round(start * n.replacementMarkup)
  const orders: NegOrder[] = []
  let verdict: string
  let reputation = 0
  let influence = 5
  let xp = false

  if (st.end === 'deal' && st.loyalty >= n.coldBelow) {
    for (let i = 1; i <= n.orders; i++) orders.push({ n: i, unit: deal, note: i === 1 ? 'по новой цене' : st.loyalty >= 70 ? 'по новой цене, блогер сам предлагает идеи' : 'по новой цене' })
    verdict = st.loyalty >= 70
      ? 'Цена снижена, и блогер на твоей стороне. Такой партнёр снимает живее, а доверие его аудитории работает на рекламу каждый следующий раз.'
      : 'Сделка рабочая. Отношения ровные — не друг, но и не враг.'
    reputation = Math.round(clamp((st.loyalty - 50) / 5, -10, 10))
    influence = st.loyalty >= 50 ? n.reward.influence : 10
    xp = true
  } else if (st.end === 'deal') {
    orders.push({ n: 1, unit: deal, note: 'скидку выжал, ролик снят без души' })
    for (let i = 2; i <= n.orders; i++)
      orders.push({ n: i, unit: replacement, note: i === 2 ? 'блогер «занят», взяли другого дороже' : 'прежний блогер больше не отвечает' })
    verdict = 'Скидку выжал и потерял блогера. Следующие ролики пришлось покупать у другого, дороже. XP за такую сделку не даётся: в сумме Дом в минусе.'
    reputation = -8
  } else {
    for (let i = 1; i <= n.orders; i++) orders.push({ n: i, unit: replacement, note: 'у другого блогера, дороже' })
    verdict =
      st.end === 'left' ? 'Блогер закончил разговор: отношения остыли. Размещение теперь берём у другого, дороже.'
      : st.end === 'walkout' ? 'У блогера кончилось терпение. Переговоры сорваны.'
      : 'Ты ушёл без сделки. Иногда это правильно — но здесь потолок скидки был выше нуля.'
    reputation = st.end === 'walk' ? 0 : -8
  }
  const saving = orders.reduce((s, o) => s + (start - o.unit) * n.volume, 0)
  const bestSaving = Math.round(start * (n.maxDiscountPct / 100)) * n.volume * n.orders
  return { start, dealUnit: st.end === 'deal' ? deal : undefined, orders, saving, bestSaving, reputation, influence, xp, verdict }
}
