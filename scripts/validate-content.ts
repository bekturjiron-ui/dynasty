// npm run validate — проверяет весь контент: схемы zod, что каждая формула считается,
// шаблоны раскрываются, а эталонные решения тренажёра проходят свою же проверку.
// Печатает ответы, чтобы их можно было вычитать глазами.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseContent, type Exercise, type Table } from '../src/content/schema'
import { baseScope, checkSteps, exerciseScope, resolveTable, withVars, unitProfit } from '../src/content/scope'
import { checkTarget, expectedValues, setCell } from '../src/content/sheetCheck'
import { evalNum, type Scope } from '../src/lib/expr'
import { render, hasBrokenTemplate } from '../src/lib/template'
import { fmtUnit } from '../src/lib/format'
import { DEFAULT_SETTINGS } from '../src/defaults'
import { jitterVars } from '../src/game/jitter'
import { choose, negScope, outcome, startNeg, type NegState } from '../src/game/negotiation'
import { rivalCurve } from '../src/game/rival'

const root = join(import.meta.dirname, '..', 'content')
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))
const lessonFiles = Object.fromEntries(readdirSync(join(root, 'lessons')).filter((f) => f.endsWith('.json')).map((f) => [f, read(join('lessons', f))]))

let problems = 0
const fail = (where: string, msg: string) => { problems++; console.log(`  ✗ ${where}: ${msg}`) }

const content = parseContent({ lessonFiles, bosses: read('bosses.json'), negotiations: read('negotiations.json'), empire: read('empire.json'), plan: read('plan.json'), ranks: read('ranks.json'), products: read('products.json'), skills: read('skills.json') })
const base = baseScope(content.products, DEFAULT_SETTINGS)

console.log(`Товары${content.productsAreDemo ? ' (ДЕМО)' : ''}: прибыль с продажи при комиссии ${DEFAULT_SETTINGS.kaspiFeePct}%, доставке ${DEFAULT_SETTINGS.deliveryCost} ₸, налоге ${DEFAULT_SETTINGS.taxPct}%, упаковке ${DEFAULT_SETTINGS.packPct}%, доставка — тариф товара`)
for (const p of content.products) console.log(`  ${p.id} ${p.name}: ${Math.round(unitProfit(p, DEFAULT_SETTINGS))} ₸`)

function checkText(where: string, text: string, scope: Scope) {
  const out = render(text, scope)
  if (hasBrokenTemplate(out)) fail(where, `шаблон не раскрылся: ${out}`)
}
function checkTable(where: string, table: Table, scope: Scope) {
  try {
    const g = resolveTable(table, scope)
    for (const row of g) for (const cell of row) if (typeof cell === 'string' && hasBrokenTemplate(cell)) fail(where, `ячейка: ${cell}`)
  } catch (e) { fail(where, `таблица: ${(e as Error).message}`) }
}
function checkExercise(where: string, ex: Exercise, scope0: Scope, mode: 'guided' | 'solo') {
  let scope: Scope
  try { scope = exerciseScope(scope0, ex) } catch (e) { fail(where, `inputs: ${(e as Error).message}`); return }
  checkText(`${where}.prompt`, ex.prompt, scope)
  ex.hints.forEach((h, i) => checkText(`${where}.hint${i}`, h, scope))
  if (ex.sheet) {
    const grid = resolveTable(ex.sheet.grid, scope)
    const exp = expectedValues(grid, ex.sheet)
    let g = grid
    for (const t of ex.sheet.targets) {
      g = setCell(g, t.cell, t.solution)
      const v = checkTarget(g, t.cell, exp[t.cell], t.mustInclude)
      if (!v.ok) fail(where, `эталон ${t.cell} ${t.solution} не проходит проверку (${v.reason})`)
    }
    console.log(`  ${where}: ${ex.sheet.targets.map((t) => `${t.cell}=${typeof exp[t.cell] === 'number' ? Math.round((exp[t.cell] as number) * 100) / 100 : exp[t.cell]}`).join(', ')}`)
    return
  }
  const parts: string[] = []
  for (const s of checkSteps(ex, mode)) {
    try {
      const v = evalNum(s.formula, scope)
      parts.push(`${s.label}: ${fmtUnit(v, s.unit)}`)
      if (s.hint) checkText(`${where}.step.hint`, s.hint, scope)
    } catch (e) { fail(where, `${s.label}: ${(e as Error).message}`) }
  }
  if (ex.report) {
    try {
      const correct = evalNum(ex.answerFormula!, scope)
      const rs = { ...scope, correct, answer: correct * 1.1, diff: correct * 0.1 }
      if (ex.report.ok) checkText(`${where}.report.ok`, ex.report.ok, rs)
      if (ex.report.off) checkText(`${where}.report.off`, ex.report.off, rs)
    } catch (e) { fail(where, `report: ${(e as Error).message}`) }
  }
  console.log(`  ${where}: ${parts.join(' · ')}`)
}

for (const w of content.weeks) {
  if (!w.lessonIds.length && !w.bossId) continue
  console.log(`\nНеделя ${w.n}: ${w.title}`)
  for (const id of w.lessonIds) {
    const l = content.lessons[id]
    if (l.week !== w.n) fail(id, `week=${l.week}, а в плане неделя ${w.n}`)
    let scope: Scope
    try { scope = withVars(base, l.vars) } catch (e) { fail(id, `vars: ${(e as Error).message}`); continue }
    checkText(`${id}.why`, l.why, scope)
    l.demo.forEach((d, i) => { checkText(`${id}.demo${i}`, d.text, scope); if (d.table) checkTable(`${id}.demo${i}`, d.table, scope) })
    if (l.analogy) checkText(`${id}.analogy`, l.analogy, scope)
    checkExercise(`${id}.guided`, l.guided, scope, 'guided')
    checkExercise(`${id}.solo`, l.solo, scope, 'solo')
  }
  if (w.bossId) {
    const b = content.bosses[w.bossId]
    for (let run = 0; run < 20; run++) {
      const vars = run === 0 ? withVars(base, b.vars) : jitterVars(withVars(base, b.vars), b.jitter)
      const tag = run === 0 ? `${b.id}` : `${b.id}#${run}`
      checkText(`${tag}.story`, b.story, vars)
      if (b.table) checkTable(`${tag}.table`, b.table, vars)
      b.rounds.forEach((r, i) => {
        if (run === 0) checkExercise(`${tag}.round${i + 1}`, r, vars, 'solo')
        else { try { evalNum(r.answerFormula!, exerciseScope(vars, r)) } catch (e) { fail(tag, (e as Error).message) } }
      })
    }
  }
}

// ---------- Переговоры: полный перебор состояний ----------
for (const n of Object.values(content.negotiations)) {
  console.log(`\nПереговоры ${n.id}: ${n.title} (${n.nodes.length} узлов)`)
  const nodes = Object.fromEntries(n.nodes.map((x) => [x.id, x]))
  const sc0 = negScope(n, base)
  checkText(`${n.id}.intro`, n.intro, sc0)
  for (const node of n.nodes) {
    checkText(`${n.id}.${node.id}`, node.npcLine, sc0)
    node.options.forEach((o, i) => checkText(`${n.id}.${node.id}.opt${i}`, o.text, sc0))
  }
  // все узлы достижимы со старта
  const seenNodes = new Set<string>([n.start])
  const q = [n.start]
  while (q.length) for (const o of nodes[q.shift()!].options) if (!o.next.startsWith('$') && !seenNodes.has(o.next)) { seenNodes.add(o.next); q.push(o.next) }
  for (const node of n.nodes) if (!seenNodes.has(node.id)) fail(n.id, `узел ${node.id} недостижим`)

  // перебор всех состояний: каждый путь должен заканчиваться (нет вечных циклов)
  const key = (s: NegState) => `${s.node}|${s.discount}|${s.loyalty}|${s.patience}|${s.cold}`
  const onStack = new Set<string>(), done = new Set<string>()
  const ends: NegState[] = []
  let loop = false
  const dfs = (s: NegState) => {
    if (s.end) { ends.push(s); return }
    const k = key(s)
    if (onStack.has(k)) { loop = true; return }
    if (done.has(k)) return
    onStack.add(k)
    for (const o of nodes[s.node].options) dfs(choose(n, s, o))
    onStack.delete(k); done.add(k)
  }
  dfs(startNeg(n))
  if (loop) fail(n.id, 'есть маршрут, который никогда не заканчивается')

  const outs = ends.map((s) => ({ s, o: outcome(n, s, base) }))
  const byEnd: Record<string, number> = {}
  for (const { s } of outs) byEnd[s.end!] = (byEnd[s.end!] ?? 0) + 1
  const goodDeals = outs.filter(({ s }) => s.end === 'deal' && s.loyalty >= n.coldBelow)
  const badDeals = outs.filter(({ s }) => s.end === 'deal' && s.loyalty < n.coldBelow)
  const best = goodDeals.reduce((m, x) => (x.o.saving > m.o.saving ? x : m), goodDeals[0])
  const worstPressure = badDeals.reduce((m, x) => (x.s.discount > m.s.discount ? x : m), badDeals[0])
  const be = sc0.target as number | undefined
  console.log(`  исходов: ${outs.length} — ${JSON.stringify(byEnd)}`)
  if (best) console.log(`  лучшая сделка с отношениями: скидка ${best.s.discount}%, цена ${best.o.dealUnit} ₸, лояльность ${best.s.loyalty}, экономия за ${n.orders} партии ${best.o.saving} ₸ (потолок ${best.o.bestSaving} ₸)`)
  if (worstPressure) console.log(`  давление: скидка ${worstPressure.s.discount}%, лояльность ${worstPressure.s.loyalty}, итог за ${n.orders} партии ${worstPressure.o.saving} ₸`)
  if (be !== undefined) {
    const reach = goodDeals.filter((x) => (x.o.dealUnit ?? Infinity) <= be).length
    console.log(`  целевой закуп ${Math.round(be)} ₸: достигают ${reach} из ${goodDeals.length} сделок с отношениями`)
    if (!reach) fail(n.id, 'ни одна честная сделка не достигает целевого закупа')
  }
  if (!goodDeals.length) fail(n.id, 'нет ни одной сделки с сохранёнными отношениями')
  if (!badDeals.length) fail(n.id, 'давление нигде не ведёт к сделке с холодным поставщиком')
  if (best && worstPressure && worstPressure.o.saving >= best.o.saving) fail(n.id, 'давление выгоднее влияния — урок перевёрнут')
  if (!outs.some(({ s }) => s.end === 'left' || s.end === 'walkout')) fail(n.id, 'поставщик ни на одном пути не уходит сам')
}

// ---------- Навыки Арсенала ----------
{
  console.log('\nНавыки Арсенала:')
  const seen = new Map<number, string>()
  for (const sk of content.skills) {
    for (const k of sk.weeks) {
      if (!content.weeks.some((w) => (w.key ?? w.n) === k)) fail(sk.id, `в плане нет недели с ключом ${k}`)
      if (seen.has(k)) fail(sk.id, `неделя ${k} уже входит в навык «${seen.get(k)}»`)
      seen.set(k, sk.id)
    }
    const lessons = sk.weeks.flatMap((k) => content.weeks.find((w) => (w.key ?? w.n) === k)?.lessonIds ?? []).length
    console.log(`  ${sk.title}: недель ${sk.weeks.length}, уроков ${lessons}`)
  }
  for (const w of content.weeks) if (!seen.has(w.key ?? w.n)) fail('навыки', `неделя ${w.n} не входит ни в один навык`)
  for (const b of content.empire.buildings)
    for (const bs of b.skills) if (!bs.weeks.every((k) => seen.has(k))) fail(b.id, `навык постройки «${bs.title}» ссылается на неделю вне навыков`)
}

// ---------- Империя: экономика построек и соперник ----------
{
  const curve = rivalCurve(content)
  console.log(`\nСоперник «${content.empire.rival.name}»: XP к неделям 2/8/16/24 — ${[2, 8, 16, 24].map((w) => curve[w]).join(' / ')}`)
  // Капитал игрока, идущего ровно по плану: уроки без подсказок + боссы + контракты (типичная неделя без контента — как неделя 1)
  const capByWeek = [0]
  for (let n = 1; n <= 24; n++) {
    const w = content.weeks.find((x) => x.n === n)
    const ls = w?.lessonIds.map((id) => content.lessons[id]) ?? []
    const boss = w?.bossId ? content.bosses[w.bossId] : undefined
    capByWeek.push(capByWeek[n - 1] + (ls.length ? ls.reduce((s, l) => s + l.reward.capital, 0) : 500) + (boss ? boss.reward.capital : w?.bossTitle !== '—' ? 300 : 0) + 500)
  }
  let spent = 0
  for (const b of content.empire.buildings) {
    for (const s of b.skills) for (const k of s.weeks) if (!content.weeks.some((w) => (w.key ?? w.n) === k)) fail(b.id, `навык «${s.title}»: в плане нет недели с ключом ${k}`)
  }
  for (const b of [...content.empire.buildings].sort((a, z) => a.cost - z.cost)) {
    if (!b.cost) continue
    const rank = content.ranks.find((r) => r.n === b.minRank)!
    const rankWeek = parseInt(rank.weeks, 10)
    const affordWeek = capByWeek.findIndex((c) => c - spent >= b.cost)
    spent += b.cost
    const when = Math.max(rankWeek, affordWeek)
    console.log(`  ${b.title}: ${b.cost} ₸, титул «${rank.title}» (с недели ${rankWeek}) → по плану доступна с недели ${affordWeek < 0 ? '—' : when}`)
    if (affordWeek < 0) fail(b.id, 'по плану на неё никогда не хватит Капитала')
    else if (when > 24) fail(b.id, 'доступна только после 24 недели')
  }
  console.log(`  Капитал за 24 недели по плану: ${capByWeek[24]} ₸, все постройки: ${spent} ₸`)
}

console.log(problems ? `\n✗ Проблем: ${problems}` : '\n✓ Контент в порядке')
process.exit(problems ? 1 : 0)
