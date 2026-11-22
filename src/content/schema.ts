import { z } from 'zod'

/** Ячейка таблицы: число, текст, «$выражение» (значение из контекста), «=формула», «12%», шаблон «{{…}}». */
export const CellSchema = z.union([z.string(), z.number(), z.null()])
export const TableSchema = z.array(z.array(CellSchema))

export const UnitSchema = z.enum(['tg', 'pct', 'num'])

export const SheetTargetSchema = z.object({
  cell: z.string().regex(/^[A-E][1-5]$/),
  solution: z.string().startsWith('='),
  label: z.string(),
  mustInclude: z.array(z.string()).optional(),
})

export const SheetTaskSchema = z.object({
  grid: TableSchema.refine((g) => g.length <= 5 && g.every((r) => r.length <= 5), 'Тренажёр — максимум 5×5'),
  targets: z.array(SheetTargetSchema).min(1),
})

export const StepSchema = z.object({
  label: z.string(),
  formula: z.string(),
  unit: UnitSchema.optional(),
  hint: z.string().optional(),
})

export const ExerciseSchema = z
  .object({
    prompt: z.string(),
    /** Число или выражение над базовым контекстом: "p2.price", "fee", "worst.cost+worst.inbound" */
    inputs: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
    steps: z.array(StepSchema).optional(),
    answerFormula: z.string().optional(),
    unit: UnitSchema.default('tg'),
    tolerance: z.number().min(0).max(0.2).default(0.01),
    hints: z.array(z.string()).default([]),
    sheet: SheetTaskSchema.optional(),
    /** Шаблоны доклада советника; доступны answer, correct, diff */
    report: z.object({ ok: z.string().optional(), off: z.string().optional() }).optional(),
  })
  .refine((e) => e.sheet || e.answerFormula, 'Нужен answerFormula или sheet')

export const DemoStepSchema = z.object({
  text: z.string(),
  table: TableSchema.optional(),
  highlight: z.array(z.string()).optional(),
})

export const SkillSchema = z.enum([
  'excel', 'unit', 'pricing', 'ads', 'kaspi', 'reviews', 'negotiation', 'analytics', 'hiring', 'career',
])

export const LessonSchema = z.object({
  id: z.string().regex(/^w\d{2}-l\d+$/),
  week: z.number().int().min(1),
  skill: SkillSchema,
  title: z.string(),
  why: z.string(),
  /** Переменные урока для демо-текстов (выражения над базовым контекстом) */
  vars: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  demo: z.array(DemoStepSchema).min(1),
  analogy: z.string().optional(),
  guided: ExerciseSchema,
  solo: ExerciseSchema,
  arsenalCard: z.object({ title: z.string(), body: z.string() }),
  reward: z.object({ capital: z.number(), xp: z.number() }),
  useRealData: z.boolean().optional(),
})

export const BossSchema = z.object({
  id: z.string(),
  week: z.number().int(),
  title: z.string(),
  story: z.string(),
  vars: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  /** Какие переменные случайно меняются при перезапуске */
  jitter: z.array(z.string()).default([]),
  table: TableSchema.optional(),
  rounds: z.array(ExerciseSchema).min(1),
  lives: z.literal(3).default(3),
  /** Подставлять продажи/цены из импорта архива Kaspi */
  useRealData: z.boolean().optional(),
  reward: z.object({ capital: z.number(), xp: z.number() }),
})

export const ProofSchema = z.enum(['checkbox', 'number', 'photo'])

// ---------- Переговоры ----------
/** effect.price — сколько процентных пунктов скидки даёт реплика; loyalty/patience — сдвиг шкал 0…100 */
export const NegOptionSchema = z.object({
  text: z.string(),
  tactic: z.enum(['pressure', 'influence', 'info', 'neutral']).default('neutral'),
  effect: z.object({ price: z.number().default(0), loyalty: z.number().default(0), patience: z.number().default(0) }),
  /** id следующего узла, либо «$deal» (сделка по текущей цене) / «$walk» (игрок уходит без сделки) */
  next: z.string(),
})
export const NegotiationNodeSchema = z.object({
  id: z.string(),
  npcLine: z.string(),
  options: z.array(NegOptionSchema).min(1).max(4),
})
export const NegotiationSchema = z.object({
  id: z.string(),
  week: z.number().int(),
  title: z.string(),
  intro: z.string(),
  supplier: z.object({ name: z.string(), company: z.string(), role: z.string() }),
  /** Товар сделки: выражение, дающее товар из products (например «p1») */
  product: z.string(),
  vars: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  /** Цена закупа на старте, ₸ (выражение) */
  startPrice: z.union([z.number(), z.string()]),
  /** Скрытый потолок скидки поставщика, % */
  maxDiscountPct: z.number().min(0).max(50),
  /** Штук в одной партии и сколько партий считать в итоге */
  volume: z.number().int().positive(),
  orders: z.number().int().min(1).default(3),
  loyalty: z.number().min(0).max(100).default(60),
  patience: z.number().min(0).max(100).default(100),
  /** Ниже этой лояльности поставщик «холодеет»; если не потеплело за 2 хода — уходит */
  coldBelow: z.number().default(35),
  /** Во сколько раз дороже обходится замена ушедшего поставщика */
  replacementMarkup: z.number().default(1.05),
  start: z.string(),
  nodes: z.array(NegotiationNodeSchema).min(12),
  reward: z.object({ xp: z.number(), influence: z.number() }),
})

// ---------- Империя ----------
/** Навык, который «питает» постройку: weeks — постоянные ключи недель плана (Week.key), прогресс считается по их урокам */
export const BuildingSkillSchema = z.object({ title: z.string(), weeks: z.array(z.number().int()).min(1) })
export const BuildingSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** Цена в Капитале; 0 — есть с самого начала */
  cost: z.number().min(0),
  /** Минимальный титул: статус не покупается одним Капиталом */
  minRank: z.number().int().min(1),
  /** Позиция на карте (viewBox 360×300) */
  x: z.number(),
  y: z.number(),
  kind: z.enum(['shop', 'warehouse', 'office', 'house', 'exchange', 'bank']),
  text: z.string(),
  skills: z.array(BuildingSkillSchema).min(1),
})
export const EmpireSchema = z.object({
  rival: z.object({ name: z.string(), motto: z.string(), news: z.array(z.object({ week: z.number().int(), text: z.string() })) }),
  buildings: z.array(BuildingSchema).min(1),
})
export type Building = z.infer<typeof BuildingSchema>
export type Empire = z.infer<typeof EmpireSchema>

/** Своя миссия наставника: привязана к неделе по её постоянному key. */
export const MissionSchema = z.object({
  id: z.string().min(1),
  weekKey: z.number().int(),
  title: z.string().min(1),
  description: z.string().default(''),
  check: z.enum(['number', 'checkbox', 'photo']),
  numberLabel: z.string().optional(),
  reward: z.object({ xp: z.number().min(0).max(1000), capital: z.number().min(0).max(5000) }),
})
export type Mission = z.infer<typeof MissionSchema>

export const WeekSchema = z.object({
  /** Позиция в плане (1…N). Меняется при перестановке. */
  n: z.number().int().min(1),
  /** Постоянный ключ недели (исходный номер). К нему привязаны контракты и условия титулов. */
  key: z.number().int().optional(),
  /** Дедлайн недели, YYYY-MM-DD. Нет — считается от даты старта. */
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  act: z.string(),
  title: z.string(),
  lessonIds: z.array(z.string()).default([]),
  bossId: z.string().optional(),
  negotiationId: z.string().optional(),
  bossTitle: z.string(),
  contract: z.object({ text: z.string(), proof: ProofSchema, numberLabel: z.string().optional() }),
  resource: z
    .object({ title: z.string(), url: z.string().optional(), kind: z.enum(['course', 'kaspi-guide', 'book', 'practice']) })
    .optional(),
})

export const ProductSchema = z.object({
  id: z.string().regex(/^p\d+$/),
  name: z.string(),
  short: z.string().optional(),
  /** Закуп за 1 шт, ₸ */
  cost: z.number().positive(),
  /** Доставка до склада на 1 шт, ₸ (0 — если уже в закупе или неизвестна) */
  inbound: z.number().min(0).default(0),
  /** Цена продажи на Kaspi, ₸ */
  price: z.number().positive(),
  /** Тариф доставки Kaspi до покупателя за счёт продавца, ₸. Нет — берётся из настроек */
  delivery: z.number().min(0).optional(),
  /** Продаж в месяц */
  orders: z.number().min(0),
})

export const RankSchema = z.object({
  n: z.number().int(),
  title: z.string(),
  weeks: z.string(),
  requirement: z.string(),
  /** Контракты недель, после которых открывается следующий титул */
  promoteWhen: z.object({ contracts: z.array(z.number().int()) }),
})

export const ProductsFileSchema = z.object({ demo: z.boolean().default(false), products: z.array(ProductSchema).min(3) })

export type Cell = z.infer<typeof CellSchema>
export type Table = z.infer<typeof TableSchema>
export type Exercise = z.infer<typeof ExerciseSchema>
export type DemoStep = z.infer<typeof DemoStepSchema>
export type Lesson = z.infer<typeof LessonSchema>
export type Boss = z.infer<typeof BossSchema>
export type Week = z.infer<typeof WeekSchema>
export type Product = z.infer<typeof ProductSchema>
export type Rank = z.infer<typeof RankSchema>
export type Step = z.infer<typeof StepSchema>
export type SheetTask = z.infer<typeof SheetTaskSchema>
export type Negotiation = z.infer<typeof NegotiationSchema>
export type NegotiationNode = z.infer<typeof NegotiationNodeSchema>
export type NegOption = z.infer<typeof NegOptionSchema>

export type Content = {
  lessons: Record<string, Lesson>
  bosses: Record<string, Boss>
  negotiations: Record<string, Negotiation>
  empire: Empire
  weeks: Week[]
  /** Свои миссии наставника (из правок плана) */
  missions: Mission[]
  ranks: Rank[]
  products: Product[]
  productsAreDemo: boolean
}

/** Разбирает и проверяет сырые JSON-файлы контента. Бросает понятную ошибку. */
export function parseContent(raw: {
  lessonFiles: Record<string, unknown>
  bosses: unknown
  negotiations?: unknown
  empire?: unknown
  plan: unknown
  ranks: unknown
  products: unknown
}): Content {
  const lessons: Record<string, Lesson> = {}
  for (const [file, data] of Object.entries(raw.lessonFiles)) {
    const arr = z.array(LessonSchema).safeParse(data)
    if (!arr.success) throw new Error(`${file}: ${z.prettifyError(arr.error)}`)
    for (const l of arr.data) {
      if (lessons[l.id]) throw new Error(`Урок ${l.id} встречается дважды`)
      lessons[l.id] = l
    }
  }
  const bossArr = z.array(BossSchema).parse(raw.bosses)
  const bosses = Object.fromEntries(bossArr.map((b) => [b.id, b]))
  const weeks = z.array(WeekSchema).parse(raw.plan).sort((a, b) => a.n - b.n).map((w) => ({ ...w, key: w.key ?? w.n }))
  const ranks = z.array(RankSchema).parse(raw.ranks).sort((a, b) => a.n - b.n)
  const pf = ProductsFileSchema.parse(raw.products)

  const negArr = z.array(NegotiationSchema).parse(raw.negotiations ?? [])
  const negotiations = Object.fromEntries(negArr.map((n) => [n.id, n]))
  for (const n of negArr) {
    const ids = new Set(n.nodes.map((x) => x.id))
    if (ids.size !== n.nodes.length) throw new Error(`Переговоры ${n.id}: повторяются id узлов`)
    if (!ids.has(n.start)) throw new Error(`Переговоры ${n.id}: нет стартового узла ${n.start}`)
    for (const node of n.nodes)
      for (const o of node.options)
        if (!o.next.startsWith('$') && !ids.has(o.next)) throw new Error(`Переговоры ${n.id}, узел ${node.id}: ведёт в несуществующий «${o.next}»`)
        else if (o.next.startsWith('$') && o.next !== '$deal' && o.next !== '$walk') throw new Error(`Переговоры ${n.id}: странный конец «${o.next}»`)
  }

  for (const w of weeks) {
    for (const id of w.lessonIds) if (!lessons[id]) throw new Error(`Неделя ${w.n}: нет урока ${id}`)
    if (w.bossId && !bosses[w.bossId]) throw new Error(`Неделя ${w.n}: нет босса ${w.bossId}`)
    if (w.negotiationId && !negotiations[w.negotiationId]) throw new Error(`Неделя ${w.n}: нет переговоров ${w.negotiationId}`)
  }
  const empire = EmpireSchema.parse(raw.empire ?? { rival: { name: 'Соперник', motto: '', news: [] }, buildings: [{ id: 'lavka', title: 'Лавка', cost: 0, minRank: 1, x: 70, y: 230, kind: 'shop', text: '' }] })
  const bIds = new Set(empire.buildings.map((b) => b.id))
  if (bIds.size !== empire.buildings.length) throw new Error('Империя: повторяются id построек')
  for (const b of empire.buildings)
    if (!ranks.some((r) => r.n === b.minRank)) throw new Error(`Постройка ${b.id}: нет титула ${b.minRank}`)

  return { lessons, bosses, negotiations, empire, weeks, missions: [], ranks, products: pf.products, productsAreDemo: pf.demo }
}
