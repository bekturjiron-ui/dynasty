// Импорт архива заказов Kaspi: чистые функции, без React и базы.
// Сохраняются ТОЛЬКО сопоставленные поля — имена, телефоны и адреса покупателей отбрасываются.
import type { Product } from '../content/schema'
import { addDays, dayKey, parseDay, weekStart } from '../lib/dates'

export type Field = 'product' | 'amount' | 'date' | 'status' | 'qty' | 'delivery' | 'category'
export const FIELDS: { key: Field; label: string; required: boolean; hint: RegExp }[] = [
  { key: 'product', label: 'Товар', required: true, hint: /название товара|товар|наименование/i },
  { key: 'amount', label: 'Сумма заказа', required: true, hint: /^сумма|стоимость товара|цена/i },
  { key: 'date', label: 'Дата заказа', required: true, hint: /дата поступления|дата заказа|^дата$/i },
  { key: 'status', label: 'Статус', required: false, hint: /^статус/i },
  { key: 'qty', label: 'Количество', required: false, hint: /количество|кол-во/i },
  { key: 'delivery', label: 'Доставка для продавца', required: false, hint: /доставки для продавца/i },
  { key: 'category', label: 'Категория', required: false, hint: /категория/i },
]
export type Mapping = Partial<Record<Field, number>>

/** Колонки, которые никогда не сохраняем и не предлагаем к сопоставлению. */
export const PII = /покупател|фио|имя|телефон|адрес|e-?mail|почта|оформил|принял|выдал|отменил|отзыв/i

export type Row = { date: string; product: string; amount: number; qty: number; status: string; delivery?: number; category: string }

/** Строка заголовков: первая строка, где ≥ 4 непустых текстовых ячеек. */
export function findHeader(rows: unknown[][]): number {
  const i = rows.findIndex((r) => r.filter((v) => typeof v === 'string' && v.trim()).length >= 4)
  return Math.max(0, i)
}

export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = {}
  for (const f of FIELDS) {
    const i = headers.findIndex((h, idx) => !PII.test(h) && f.hint.test(h.trim()) && !Object.values(m).includes(idx))
    if (i >= 0) m[f.key] = i
  }
  // «Название товара в Kaspi Магазине» важнее «Названия в системе продавца»
  const kaspiName = headers.findIndex((h) => /в kaspi/i.test(h))
  if (kaspiName >= 0) m.product = kaspiName
  return m
}

const num = (v: unknown): number => {
  if (typeof v === 'number') return v
  const s = String(v ?? '').replace(/[\s ₸]/g, '').replace(',', '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/** Дата из «01.09.2026», «2026-09-01», Excel-серийного числа или Date. */
export function toDay(v: unknown): string | null {
  if (v instanceof Date && !isNaN(+v)) return dayKey(v)
  if (typeof v === 'number' && v > 30000 && v < 80000) return dayKey(new Date(Math.round((v - 25569) * 86400000) + new Date().getTimezoneOffset() * 60000))
  const s = String(v ?? '').trim()
  let m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

/** Сырые строки листа → нормализованные заказы. Берутся только сопоставленные колонки. */
export function normalize(rows: unknown[][], headerRow: number, map: Mapping): { rows: Row[]; skipped: number } {
  const out: Row[] = []
  let skipped = 0
  for (const r of rows.slice(headerRow + 1)) {
    const product = map.product !== undefined ? String(r[map.product] ?? '').trim() : ''
    const date = map.date !== undefined ? toDay(r[map.date]) : null
    if (!product || !date) { if (r.some((v) => v !== null && v !== '')) skipped++; continue }
    out.push({
      date,
      product,
      amount: map.amount !== undefined ? num(r[map.amount]) : 0,
      qty: map.qty !== undefined ? num(r[map.qty]) || 1 : 1,
      status: map.status !== undefined ? String(r[map.status] ?? '').trim() : '',
      delivery: map.delivery !== undefined ? num(r[map.delivery]) : undefined,
      category: map.category !== undefined ? String(r[map.category] ?? '').trim() : '',
    })
  }
  return { rows: out, skipped }
}

export type Filter = { statuses: string[]; excludeCategories: string[] }

/** По умолчанию считаем только выданные/доставленные заказы. */
export function defaultFilter(rows: Row[]): Filter {
  const statuses = [...new Set(rows.map((r) => r.status))]
  const ok = statuses.filter((s) => /выдан|доставлен|заверш|выполнен/i.test(s))
  return { statuses: ok.length ? ok : statuses, excludeCategories: [] }
}
export const applyFilter = (rows: Row[], f: Filter) =>
  rows.filter((r) => (!r.status || f.statuses.includes(r.status)) && !f.excludeCategories.includes(r.category))

export type ProductStat = { name: string; category: string; orders: number; qty: number; revenue: number; avgPrice: number; avgDelivery?: number; perMonth: number }

export function period(rows: Row[]) {
  const days = rows.map((r) => r.date).sort()
  const from = days[0], to = days[days.length - 1]
  const span = from ? Math.max(1, Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86400000) + 1) : 0
  return { from, to, days: span, months: span / 30.4 }
}

export function byProduct(rows: Row[]): ProductStat[] {
  const { months } = period(rows)
  const m = new Map<string, ProductStat & { dSum: number; dN: number }>()
  for (const r of rows) {
    const s = m.get(r.product) ?? { name: r.product, category: r.category, orders: 0, qty: 0, revenue: 0, avgPrice: 0, perMonth: 0, dSum: 0, dN: 0 }
    s.orders++; s.qty += r.qty; s.revenue += r.amount
    if (r.delivery !== undefined) { s.dSum += r.delivery; s.dN++ }
    m.set(r.product, s)
  }
  return [...m.values()]
    .map(({ dSum, dN, ...s }) => ({ ...s, avgPrice: s.qty ? s.revenue / s.qty : 0, avgDelivery: dN ? dSum / dN : undefined, perMonth: months ? s.qty / Math.max(1, months) : s.qty }))
    .sort((a, b) => b.revenue - a.revenue)
}

export type WeekStat = { week: string; label: string; revenue: number; orders: number; margin?: number }

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const label = (k: string) => { const d = parseDay(k); return `${d.getDate()} ${MONTHS[d.getMonth()]}` }

/** Выручка и маржа по календарным неделям (с понедельника). Маржа — только по товарам, у которых известен закуп. */
export function byWeek(rows: Row[], costOf: (name: string) => number | undefined, rates: { fee: number; tax: number; pack: number }): WeekStat[] {
  const m = new Map<string, WeekStat & { mRev: number; mProfit: number }>()
  for (const r of rows) {
    const k = weekStart(r.date)
    const s = m.get(k) ?? { week: k, label: label(k), revenue: 0, orders: 0, mRev: 0, mProfit: 0 }
    s.revenue += r.amount; s.orders++
    const cost = costOf(r.product)
    if (cost !== undefined) {
      s.mRev += r.amount
      s.mProfit += r.amount * (1 - rates.fee - rates.tax - rates.pack) - (r.delivery ?? 0) - cost * r.qty
    }
    m.set(k, s)
  }
  // недели без единого заказа — нулями, чтобы провалы были видны на графике
  const keys = [...m.keys()].sort()
  for (let k = keys[0]; k && k < keys[keys.length - 1]; k = addDays(k, 7))
    if (!m.has(k)) m.set(k, { week: k, label: label(k), revenue: 0, orders: 0, mRev: 0, mProfit: 0 })
  return [...m.values()].sort((a, b) => a.week.localeCompare(b.week)).map(({ mRev, mProfit, ...s }) => ({ ...s, margin: mRev ? mProfit / mRev : undefined }))
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9%]+/g, ' ').trim()
const tokens = (s: string) => new Set(norm(s).split(' ').filter((t) => t.length > 1))

/** Какой товар из уроков соответствует названию из архива. Названия в уроках — из карточек Kaspi, поэтому
 *  сначала ищем вхождение, потом — совпадение ≥ 80% слов названия урока. */
export function matchProduct(name: string, products: Product[]): Product | undefined {
  const n = norm(name)
  const direct = products.find((p) => n.includes(norm(p.name)))
  if (direct) return direct
  const t = tokens(name)
  let best: { p: Product; score: number } | undefined
  for (const p of products) {
    const pt = tokens(p.name)
    const hit = [...pt].filter((x) => t.has(x)).length / Math.max(1, pt.size)
    if (hit >= 0.8 && (!best || hit > best.score)) best = { p, score: hit }
  }
  return best?.p
}

/** Поправки к товарам уроков по архиву: цена, продажи в месяц, доставка. Варианты карточек одного товара суммируются. */
export type Override = { id: string; price: number; orders: number; delivery?: number; matched: string[] }
export function overridesFrom(rows: Row[], products: Product[]): Override[] {
  const stats = byProduct(rows)
  const acc = new Map<string, { rev: number; qty: number; perMonth: number; dSum: number; dN: number; matched: string[] }>()
  for (const s of stats) {
    const p = matchProduct(s.name, products)
    if (!p) continue
    const a = acc.get(p.id) ?? { rev: 0, qty: 0, perMonth: 0, dSum: 0, dN: 0, matched: [] }
    a.rev += s.revenue; a.qty += s.qty; a.perMonth += s.perMonth; a.matched.push(s.name)
    if (s.avgDelivery !== undefined) { a.dSum += s.avgDelivery * s.orders; a.dN += s.orders }
    acc.set(p.id, a)
  }
  return [...acc.entries()].map(([id, a]) => ({
    id,
    price: Math.round(a.rev / Math.max(1, a.qty) / 10) * 10,
    // от 5 в месяц — целыми («10 продаж»), меньше — с одним знаком («1,5»)
    orders: a.perMonth >= 5 ? Math.round(a.perMonth) : Math.round(a.perMonth * 10) / 10,
    delivery: a.dN ? Math.round(a.dSum / a.dN) : undefined,
    matched: a.matched,
  }))
}

export function applyOverrides(products: Product[], ov: Override[], fields: { price: boolean; orders: boolean; delivery: boolean }): Product[] {
  return products.map((p) => {
    const o = ov.find((x) => x.id === p.id)
    if (!o) return p
    return {
      ...p,
      price: fields.price && o.price > 0 ? o.price : p.price,
      orders: fields.orders ? o.orders : p.orders,
      delivery: fields.delivery && o.delivery ? o.delivery : p.delivery,
    }
  })
}
