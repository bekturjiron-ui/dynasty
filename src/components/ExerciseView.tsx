import { useMemo, useState } from 'react'
import type { Exercise } from '../content/schema'
import { checkAd, type AdIssue } from '../content/adCheck'
import { checkSteps, exerciseScope, resolveTable } from '../content/scope'
import { checkTarget, expectedValues, setCell, type SheetVerdict } from '../content/sheetCheck'
import { evalNum, type Scope } from '../lib/expr'
import { closeEnough, fmtNum, fmtUnit, parseUserNumber, toRaw } from '../lib/format'
import { parseAddr, type CellResult, type Grid } from '../lib/sheet'
import { render } from '../lib/template'
import { TermText } from './Glossary'
import { TableView } from './TableView'
import { Advisor, Button, Icon } from './ui'

type Props = {
  ex: Exercise
  scope: Scope
  mode: 'guided' | 'solo'
  /** Задача решена (все шаги/ячейки сошлись) */
  onSolved: (r: { attempts: number }) => void
  /** Ответ не сошёлся (для босса — минус жизнь) */
  onOff?: () => void
  /** Текст кнопки после решения */
  doneLabel?: string
  /** Советник показывает решение текущего шага (после всех подсказок) */
  reveal?: boolean
}

export function ExerciseView(props: Props) {
  if (props.ex.choice) return <ChoiceExercise {...props} />
  if (props.ex.textCheck) return <TextExercise {...props} />
  return props.ex.sheet ? <SheetExercise {...props} /> : <NumberExercise {...props} />
}

// ---------------- Выбор решения ----------------

function ChoiceExercise({ ex, scope: scope0, onSolved, onOff, doneLabel = 'Дальше', reveal }: Props) {
  const scope = useMemo(() => exerciseScope(scope0, ex), [scope0, ex])
  // Порядок вариантов перемешан один раз, чтобы верный ответ не стоял всегда на одном месте
  const [options] = useState(() => ex.choice!.options.map((o) => ({ o, k: Math.random() })).sort((a, b) => a.k - b.k).map((x) => x.o))
  const [tried, setTried] = useState<number[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const solved = picked !== null && options[picked].correct

  function pick(i: number) {
    if (solved || tried.includes(i)) return
    setPicked(i)
    setTried((t) => [...t, i])
    if (!options[i].correct) onOff?.()
  }

  return (
    <div className="space-y-3">
      <p className="text-[17px] leading-relaxed"><TermText text={render(ex.prompt, scope)} /></p>
      <div className="space-y-2">
        {options.map((o, i) => {
          const was = tried.includes(i)
          const hint = reveal && o.correct && !solved
          return (
            <button key={i} onClick={() => pick(i)} disabled={solved || was} className={`choice surface w-full rounded-xl border px-4 py-3.5 text-left text-[15px] leading-snug ${was ? (o.correct ? 'border-gain/60' : 'border-loss/50 opacity-70') : hint ? 'border-gold' : 'border-line'}`}>
              <span className="flex items-start gap-2">{was && o.correct && <span className="text-gain"><Icon name="check" size={18} /></span>}<span><TermText text={render(o.text, scope)} interactiveParent /></span></span>
            </button>
          )
        })}
      </div>
      {reveal && !solved && <p className="text-[14px] text-gold-soft">Советник подсветил решение золотой рамкой.</p>}
      {picked !== null && <Advisor tone={options[picked].correct ? 'gain' : 'loss'}><TermText text={render(options[picked].why, scope)} /></Advisor>}
      {solved && <Button full onClick={() => onSolved({ attempts: tried.length })}>{doneLabel}</Button>}
    </div>
  )
}

// ---------------- Текст объявления ----------------

function TextExercise({ ex, scope: scope0, onSolved, onOff, doneLabel = 'Дальше', reveal }: Props) {
  const c = ex.textCheck!
  const scope = useMemo(() => exerciseScope(scope0, ex), [scope0, ex])
  const [val, setVal] = useState('')
  const [issues, setIssues] = useState<AdIssue[] | null>(null)
  const [attempts, setAttempts] = useState(0)
  const solved = issues !== null && issues.length === 0
  const len = val.trim().length

  function check() {
    const found = checkAd(val, c)
    setAttempts((a) => a + 1)
    setIssues(found)
    if (found.length) onOff?.()
  }

  return (
    <div className="space-y-3">
      <p className="text-[17px] leading-relaxed"><TermText text={render(ex.prompt, scope)} /></p>
      <textarea value={val} readOnly={solved} onChange={(e) => { setVal(e.target.value); setIssues(null) }} rows={4} placeholder={c.placeholder ?? 'Текст объявления'} className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-[16px] leading-relaxed text-parch outline-none focus:border-gold" />
      <div className={`text-right text-[13px] tabular-nums ${len > c.maxLength ? 'text-loss' : 'text-muted'}`}>{len} / {c.maxLength}</div>
      {reveal && !solved && <p className="text-[14px] text-gold-soft">Советник: например, «{render(c.sample, scope)}»</p>}
      {issues && issues.length > 0 && <Advisor tone="loss">{issues.map((x) => x.text).join(' ')}</Advisor>}
      {solved && <Advisor tone="gain">Объявление проходит проверку: {len} знаков, правила площадки соблюдены.</Advisor>}
      {solved ? <Button full onClick={() => onSolved({ attempts })}>{doneLabel}</Button> : <Button full onClick={check} disabled={!len}>Проверить объявление</Button>}
    </div>
  )
}

// ---------------- Числовые задачи ----------------

function NumberExercise({ ex, scope: scope0, mode, onSolved, onOff, doneLabel = 'Дальше', reveal }: Props) {
  const scope = useMemo(() => exerciseScope(scope0, ex), [scope0, ex])
  const steps = useMemo(() => checkSteps(ex, mode), [ex, mode])
  const [idx, setIdx] = useState(0)
  const [val, setVal] = useState('')
  const [done, setDone] = useState<{ label: string; text: string }[]>([])
  const [note, setNote] = useState<{ tone: 'gain' | 'loss'; text: string } | null>(null)
  const [attempts, setAttempts] = useState(0)
  const solved = idx >= steps.length

  const step = steps[Math.min(idx, steps.length - 1)]
  const correct = evalNum(step.formula, scope)

  function check() {
    const n = parseUserNumber(val)
    if (n === null) { setNote({ tone: 'loss', text: 'Советнику нужно число. Например: 1 250 или 13,5' }); return }
    const answer = toRaw(n, step.unit)
    setAttempts((a) => a + 1)
    const isLast = idx === steps.length - 1
    const rs = { ...scope, answer, correct, diff: answer - correct }
    if (closeEnough(answer, correct, ex.tolerance, step.unit)) {
      setDone((d) => [...d, { label: step.label, text: fmtUnit(answer, step.unit) }])
      setVal('')
      const okText = isLast && ex.report?.ok ? render(ex.report.ok, rs) : isLast ? `Расчёт сходится: ${fmtUnit(correct, step.unit)}.` : 'Сходится. Следующий шаг.'
      setNote({ tone: 'gain', text: okText })
      setIdx((i) => i + 1)
    } else {
      onOff?.()
      let text: string
      if (mode === 'guided') {
        text = `Советник получил другое число. ${step.hint ? render(step.hint, scope) : ''}`
      } else if (ex.report?.off) {
        text = render(ex.report.off, rs)
      } else {
        text = `В докладе ${fmtUnit(answer, step.unit)}, а касса покажет ${answer > correct ? 'меньше' : 'больше'}. Проверь, все ли статьи учтены.`
      }
      setNote({ tone: 'loss', text })
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[17px] leading-relaxed"><TermText text={render(ex.prompt, scope)} /></p>

      {done.map((d, i) => (
        <div key={i} className="flex items-center justify-between rounded-xl border border-gain/40 bg-gain/5 px-4 py-3">
          <span className="text-[14px] text-muted"><TermText text={d.label} /></span>
          <span className="flex items-center gap-1 font-semibold text-gain tabular-nums"><Icon name="check" size={18} />{d.text}</span>
        </div>
      ))}

      {!solved && (
        <div className="space-y-2">
          <label className="block text-[14px] text-muted">{steps.length > 1 ? `Шаг ${idx + 1} из ${steps.length}. ` : ''}<TermText text={step.label} /></label>
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && check()}
              placeholder={step.unit === 'pct' ? 'например, 18,5' : step.unit === 'tg' ? 'сумма в ₸' : 'число'}
              className="min-h-12 w-full rounded-xl border border-line bg-ink px-4 text-[18px] tabular-nums text-parch outline-none focus:border-gold"
            />
            <span className="flex min-w-10 items-center justify-center text-muted">{step.unit === 'pct' ? '%' : step.unit === 'tg' ? '₸' : ''}</span>
          </div>
          {reveal && <p className="text-[14px] text-gold-soft">Советник: здесь выходит {fmtUnit(correct, step.unit)}. Впиши и сверь с подсказками, откуда это число.</p>}
          <Button full onClick={check} disabled={!val.trim()}>Проверить</Button>
        </div>
      )}

      {note && <Advisor tone={note.tone}><TermText text={note.text} /></Advisor>}
      {solved && <Button full onClick={() => onSolved({ attempts })}>{doneLabel}</Button>}
    </div>
  )
}

// ---------------- Тренажёр таблицы ----------------

const KEYS = ['=', 'СУММ(', ':', '*', '/', '-', '+', '(', ')', '$']
const showValue = (v: CellResult) => (typeof v === 'string' ? `«${v}»` : fmtNum(v))

/** Быстрые клавиши под задание: функции и знаки из эталонных формул (на iPhone до «;» и кавычек далеко). */
function keysFor(solutions: string[]): string[] {
  const all = solutions.join(' ')
  const fns = [...new Set(all.match(/[А-ЯЁ]+(?=\()/g) ?? [])].map((f) => `${f}(`)
  const extra = [';', '"', '<', '>'].filter((k) => all.includes(k))
  return [...new Set(['=', ...fns, ...extra, ...KEYS])]
}

function verdictText(cell: string, v: Extract<SheetVerdict, { ok: false }>): string {
  if (v.reason === 'missing' && v.missing === ';0)') return `Значение в ${cell} сходится случайно. Поставь в конце ВПР 0: без него таблица ищет примерно и подставит чужое значение.`
  if (v.reason === 'not_found') return `В ${cell} таблица показывает #Н/Д: такого значения нет там, где она ищет. Проверь, что ищешь по нужной ячейке и в нужном диапазоне.`
  switch (v.reason) {
    case 'empty': return `В ${cell} пока пусто.`
    case 'not_formula': return `В ${cell} вписано готовое число. Советнику нужна формула: она начинается с «=» и ссылается на ячейки — тогда таблица пересчитает сама.`
    case 'no_refs': return `Формула в ${cell} считает голые числа. Сошлись на ячейки (например, B2), чтобы таблица пересчитывалась сама.`
    case 'missing':
      return v.missing?.includes('$')
        ? `Число в ${cell} сходится, но при копировании вниз ссылка на ставку уедет. Закрепи её: ${v.missing}.`
        : v.missing?.toUpperCase().startsWith('SUM')
          ? `Число в ${cell} сходится, но здесь тренируем СУММ: так формула выдержит и 300 строк.`
          : `В формуле ${cell} не хватает «${v.missing}».`
    case 'error': return `Формула в ${cell} не считается: ${v.message ?? ''}`
    case 'value': return `В ${cell} получилось ${showValue(v.value ?? 0)}. Советник ждал другое число — проверь, на какие ячейки ссылаешься.`
  }
}

function SheetExercise({ ex, scope: scope0, mode, onSolved, onOff, doneLabel = 'Дальше', reveal }: Props) {
  const task = ex.sheet!
  const scope = useMemo(() => exerciseScope(scope0, ex), [scope0, ex])
  const baseGrid = useMemo(() => resolveTable(task.grid, scope), [task, scope])
  const expected = useMemo(() => expectedValues(baseGrid, task), [baseGrid, task])
  const targets = task.targets
  const [grid, setGrid] = useState<Grid>(() => baseGrid.map((r) => { const row = [...r]; while (row.length < Math.max(...baseGrid.map((x) => x.length))) row.push(null); return row }))
  const [verified, setVerified] = useState<string[]>([])
  const [sel, setSel] = useState(targets[0].cell)
  const [note, setNote] = useState<{ tone: 'gain' | 'loss'; text: string } | null>(null)
  const [attempts, setAttempts] = useState(0)

  const guidedIdx = targets.findIndex((t) => !verified.includes(t.cell))
  const solved = verified.length === targets.length
  const current = targets.find((t) => t.cell === sel)
  const raw = (() => { const { r, c } = parseAddr(sel); const v = grid[r]?.[c]; return v === null || v === undefined ? '' : String(v) })()
  const editable = mode === 'guided' ? (guidedIdx >= 0 ? [targets[guidedIdx].cell] : []) : targets.map((t) => t.cell).filter((c) => !verified.includes(c))

  function write(text: string) {
    setGrid((g) => setCell(g, sel, text === '' ? null : text))
  }
  function tap(a: string) {
    if (editable.includes(a)) { setSel(a); return }
    // Тап по другой ячейке во время набора формулы вставляет её адрес — как в Excel
    if (raw.startsWith('=') && current && !verified.includes(sel)) write(raw + a)
  }

  function check() {
    setAttempts((x) => x + 1)
    const toCheck = mode === 'guided' ? [targets[guidedIdx]] : targets.filter((t) => !verified.includes(t.cell))
    const ok: string[] = []
    let firstOff: string | null = null
    for (const t of toCheck) {
      const v = checkTarget(grid, t.cell, expected[t.cell], t.mustInclude)
      if (v.ok) ok.push(t.cell)
      else if (!firstOff) firstOff = verdictText(t.cell, v)
    }
    const nowVerified = [...verified, ...ok]
    setVerified(nowVerified)
    if (firstOff) {
      onOff?.()
      setNote({ tone: 'loss', text: firstOff })
      const next = targets.find((t) => !nowVerified.includes(t.cell))
      if (next) setSel(next.cell)
    } else {
      const next = targets.find((t) => !nowVerified.includes(t.cell))
      if (next) { setSel(next.cell); setNote({ tone: 'gain', text: 'Сходится. Дальше — следующая ячейка.' }) }
      else setNote({ tone: 'gain', text: `Таблица сходится: ${targets.map((t) => `${t.cell} = ${showValue(expected[t.cell])}`).join(', ')}. Формулы пересчитают её сами, если поменяются цифры.` })
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[17px] leading-relaxed"><TermText text={render(ex.prompt, scope)} /></p>
      {!solved && current && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 px-3 py-2 text-[14px]">
          <span className="font-semibold text-gold">{sel}</span> · <TermText text={mode === 'guided' ? targets[guidedIdx]?.label ?? '' : current.label} />
        </div>
      )}

      <TableView grid={grid} editable={editable} selected={solved ? undefined : sel} verified={verified} onSelect={solved ? undefined : tap} />

      {!solved && (
        <>
          <input
            value={raw}
            onChange={(e) => write(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && check()}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder={`Формула для ${sel}, например =B2*C2`}
            className="min-h-12 w-full rounded-xl border border-line bg-ink px-4 font-mono text-[17px] text-gold-soft outline-none focus:border-gold"
          />
          <div className="flex flex-wrap gap-1.5">
            {keysFor(targets.map((t) => t.solution)).map((k) => (
              <button key={k} onClick={() => write(raw + k)} className="min-h-10 min-w-10 rounded-lg border border-line bg-panel2 px-2 font-mono text-[15px] text-parch active:bg-line">{k}</button>
            ))}
            <button onClick={() => write(raw.slice(0, -1))} className="min-h-10 min-w-12 rounded-lg border border-line bg-panel2 px-2 text-[15px] text-muted active:bg-line">⌫</button>
          </div>
          <p className="text-[12px] text-muted">Пока пишешь формулу, тап по ячейке таблицы вставит её адрес.</p>
          {reveal && current && <p className="text-[14px] text-gold-soft">Советник: в {sel} пишут <span className="font-mono">{current.solution}</span></p>}
          <Button full onClick={check}>{mode === 'guided' ? `Проверить ${sel}` : 'Проверить таблицу'}</Button>
        </>
      )}

      {note && <Advisor tone={note.tone}><TermText text={note.text} /></Advisor>}
      {solved && <Button full onClick={() => onSolved({ attempts })}>{doneLabel}</Button>}
    </div>
  )
}
