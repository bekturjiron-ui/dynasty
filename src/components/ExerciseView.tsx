import { useMemo, useState } from 'react'
import type { Exercise } from '../content/schema'
import { checkSteps, exerciseScope, resolveTable } from '../content/scope'
import { checkTarget, expectedValues, setCell, type SheetVerdict } from '../content/sheetCheck'
import { evalNum, type Scope } from '../lib/expr'
import { closeEnough, fmtNum, fmtUnit, parseUserNumber, toRaw } from '../lib/format'
import { parseAddr, type Grid } from '../lib/sheet'
import { render } from '../lib/template'
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
  return props.ex.sheet ? <SheetExercise {...props} /> : <NumberExercise {...props} />
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
      <p className="text-[17px] leading-relaxed">{render(ex.prompt, scope)}</p>

      {done.map((d, i) => (
        <div key={i} className="flex items-center justify-between rounded-xl border border-gain/40 bg-gain/5 px-4 py-3">
          <span className="text-[14px] text-muted">{d.label}</span>
          <span className="flex items-center gap-1 font-semibold text-gain tabular-nums"><Icon name="check" size={18} />{d.text}</span>
        </div>
      ))}

      {!solved && (
        <div className="space-y-2">
          <label className="block text-[14px] text-muted">{steps.length > 1 ? `Шаг ${idx + 1} из ${steps.length}. ` : ''}{step.label}</label>
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

      {note && <Advisor tone={note.tone}>{note.text}</Advisor>}
      {solved && <Button full onClick={() => onSolved({ attempts })}>{doneLabel}</Button>}
    </div>
  )
}

// ---------------- Тренажёр таблицы ----------------

const KEYS = ['=', 'СУММ(', ':', '*', '/', '-', '+', '(', ')', '$']

function verdictText(cell: string, v: Extract<SheetVerdict, { ok: false }>): string {
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
    case 'value': return `В ${cell} получилось ${fmtNum(v.value ?? 0)}. Советник ждал другое число — проверь, на какие ячейки ссылаешься.`
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
      else setNote({ tone: 'gain', text: `Таблица сходится: ${targets.map((t) => `${t.cell} = ${fmtNum(expected[t.cell])}`).join(', ')}. Формулы пересчитают её сами, если поменяются цифры.` })
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[17px] leading-relaxed">{render(ex.prompt, scope)}</p>
      {!solved && current && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 px-3 py-2 text-[14px]">
          <span className="font-semibold text-gold">{sel}</span> · {mode === 'guided' ? targets[guidedIdx]?.label : current.label}
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
            {KEYS.map((k) => (
              <button key={k} onClick={() => write(raw + k)} className="min-h-10 min-w-10 rounded-lg border border-line bg-panel2 px-2 font-mono text-[15px] text-parch active:bg-line">{k}</button>
            ))}
            <button onClick={() => write(raw.slice(0, -1))} className="min-h-10 min-w-12 rounded-lg border border-line bg-panel2 px-2 text-[15px] text-muted active:bg-line">⌫</button>
          </div>
          <p className="text-[12px] text-muted">Пока пишешь формулу, тап по ячейке таблицы вставит её адрес.</p>
          {reveal && current && <p className="text-[14px] text-gold-soft">Советник: в {sel} пишут <span className="font-mono">{current.solution}</span></p>}
          <Button full onClick={check}>{mode === 'guided' ? `Проверить ${sel}` : 'Проверить таблицу'}</Button>
        </>
      )}

      {note && <Advisor tone={note.tone}>{note.text}</Advisor>}
      {solved && <Button full onClick={() => onSolved({ attempts })}>{doneLabel}</Button>}
    </div>
  )
}
