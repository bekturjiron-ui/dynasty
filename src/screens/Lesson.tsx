import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { content } from '../content'
import { resolveTable, withVars } from '../content/scope'
import { completeLesson } from '../game/engine'
import { planWeekN } from '../game/plan'
import { useGame } from '../game/useGame'
import { render } from '../lib/template'
import { ExerciseView } from '../components/ExerciseView'
import { TermText } from '../components/Glossary'
import { TableView } from '../components/TableView'
import { VideoBlock } from '../components/VideoBlock'
import { Advisor, Button, Icon, Label } from '../components/ui'

type Phase = 'why' | 'demo' | 'guided' | 'solo' | 'report'
const PHASES: { key: Phase; label: string }[] = [
  { key: 'why', label: 'Зачем' },
  { key: 'demo', label: 'Профи' },
  { key: 'guided', label: 'Вместе' },
  { key: 'solo', label: 'Сам' },
  { key: 'report', label: 'Доклад' },
]

export default function LessonScreen() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const game = useGame()
  const lesson = content.lessons[id]

  const [phase, setPhase] = useState<Phase>('why')
  const [demoIdx, setDemoIdx] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [helpIdx, setHelpIdx] = useState(0) // сколько пунктов помощи открыто в текущей фазе
  const [soloHints, setSoloHints] = useState(0)
  const [soloOffs, setSoloOffs] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [gain, setGain] = useState<{ capital: number; xp: number } | null>(null)
  const touchX = useRef<number | null>(null)

  // Контекст урока фиксируется на старте, чтобы цифры не прыгали при смене настроек
  const scope = useMemo(() => (game.loading || !lesson ? null : withVars(game.scope, lesson.vars)), [game.loading, lesson]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!lesson) return <Missing onBack={() => nav('/')} />
  if (!scope) return null

  const phaseIdx = PHASES.findIndex((p) => p.key === phase)
  const exercise = phase === 'guided' ? lesson.guided : phase === 'solo' ? lesson.solo : null

  // Пункты «Не понял»: аналогия → подсказки текущего упражнения → решение
  const helpItems: { kind: 'analogy' | 'hint' | 'reveal'; text: string }[] = []
  if (lesson.analogy) helpItems.push({ kind: 'analogy', text: render(lesson.analogy, scope) })
  if (exercise) {
    const exScope = withVars(scope, exercise.inputs)
    exercise.hints.forEach((h) => helpItems.push({ kind: 'hint', text: render(h, exScope) }))
    helpItems.push({ kind: 'reveal', text: 'Советник покажет решение текущего шага.' })
  }

  function openHelp() {
    setSheetOpen(true)
    if (helpIdx === 0) nextHelp()
  }
  function nextHelp() {
    const item = helpItems[helpIdx]
    if (!item) return
    if (phase === 'solo' && item.kind !== 'analogy') setSoloHints((n) => n + 1)
    if (item.kind === 'reveal') { setReveal(true); setSheetOpen(false) }
    setHelpIdx((i) => i + 1)
  }
  function go(p: Phase) {
    setPhase(p)
    setHelpIdx(0)
    setReveal(false)
    setSheetOpen(false)
    window.scrollTo({ top: 0 })
  }
  async function finishSolo(n: number) {
    const total = attempts + n
    setAttempts(total)
    const g = await completeLesson(content, lesson.id, soloHints, total)
    setGain(g)
    go('report')
  }

  const demo = lesson.demo[demoIdx]
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (dx < -50) demoNext()
    if (dx > 50 && demoIdx > 0) setDemoIdx((i) => i - 1)
  }
  function demoNext() {
    if (demoIdx < lesson.demo.length - 1) setDemoIdx((i) => i + 1)
    else go('guided')
  }

  return (
    <div className="scene-lesson pt-safe mx-auto min-h-dvh max-w-2xl px-4 pb-28 md:pt-8">
      {/* Шапка: закрыть + 5 фаз цикла */}
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => nav(-1)} aria-label="Закрыть урок" className="flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-panel">
          <Icon name="close" />
        </button>
        <div className="flex flex-1 gap-1.5">
          {PHASES.map((p, i) => (
            <div key={p.key} className="flex-1">
              <div className={`h-1.5 rounded-full transition-colors duration-500 ${i < phaseIdx ? 'bg-gold' : i === phaseIdx ? 'phase-active bg-gold-soft' : 'bg-line'}`} />
              <div className={`mt-1 text-center text-[10px] md:text-[12px] ${i === phaseIdx ? 'text-gold' : 'text-muted'}`}>{p.label}</div>
            </div>
          ))}
        </div>
      </div>

      <Label>Неделя {game.loading ? lesson.week : planWeekN(game.content.weeks, (w) => w.lessonIds.includes(lesson.id), lesson.week)} · <TermText text={lesson.title} /></Label>

      {phase === 'why' && (
        <div className="animate-rise mt-10 space-y-8">
          <p className="font-serif text-[28px] leading-snug text-parch"><TermText text={render(lesson.why, scope)} /></p>
          <Button full onClick={() => go('demo')}>Смотреть, как делает профи</Button>
        </div>
      )}

      {phase === 'demo' && demo && (
        <div className="mt-4 space-y-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="text-[13px] text-muted">Разбор {demoIdx + 1} из {lesson.demo.length} · листай свайпом · нажми на подсвеченный термин для расшифровки</div>
          {lesson.video && demoIdx === 0 && <VideoBlock video={lesson.video} />}
          <div key={demoIdx} className="animate-rise space-y-4">
            <p className="text-[17px] leading-relaxed"><TermText text={render(demo.text, scope)} /></p>
            {demo.table && <TableView grid={resolveTable(demo.table, scope)} highlight={demo.highlight} />}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDemoIdx((i) => i - 1)} disabled={demoIdx === 0}>Назад</Button>
            <Button full onClick={demoNext}>{demoIdx < lesson.demo.length - 1 ? 'Дальше' : 'Теперь вместе'}</Button>
          </div>
        </div>
      )}

      {phase === 'guided' && (
        <div className="mt-4 space-y-3">
          <div className="text-[13px] text-muted">Вместе: советник проверяет каждый шаг</div>
          <ExerciseView key="guided" ex={lesson.guided} scope={scope} mode="guided" reveal={reveal} doneLabel="Теперь сам" onSolved={(r) => { setAttempts((a) => a + r.attempts); go('solo') }} />
        </div>
      )}

      {phase === 'solo' && (
        <div className="mt-4 space-y-3">
          <div className="text-[13px] text-muted">{lesson.solo.choice ? 'Сам: выбери решение' : lesson.solo.textCheck ? 'Сам: напиши так, чтобы прошло модерацию' : 'Сам: проверяется только итог'}</div>
          <ExerciseView key="solo" ex={lesson.solo} scope={scope} mode="solo" reveal={reveal} doneLabel="К докладу" onOff={() => setSoloOffs((n) => n + 1)} onSolved={(r) => finishSolo(r.attempts)} />
          {soloOffs >= 2 && helpIdx === 0 && <p className="text-center text-[13px] text-muted">Застрял? Кнопка «Не понял» внизу — советник подскажет.</p>}
        </div>
      )}

      {phase === 'report' && (
        <div className="animate-rise mt-6 space-y-4">
          <Advisor tone="gain">
            {gain && (gain.capital || gain.xp)
              ? <>Урок закрыт{soloHints ? ' с помощью советника' : ' без подсказок'}. В казну Дома: <b className="text-gold">+{gain.capital} ₸ Капитала</b>{gain.xp ? <>, <b className="text-gold">+{gain.xp} XP</b></> : null}.{soloHints ? ' Пройди «Сам» ещё раз без подсказок — советник доплатит вторую половину Капитала.' : ''}</>
              : <>Повтор засчитан в серию дней. Награда за этот урок уже в казне.</>}
          </Advisor>
          <div className="surface-gold rounded-2xl border p-4">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-gold"><Icon name="arsenal" size={16} /> В Арсенал добавлено навсегда</div>
            <div className="font-serif text-[20px] text-parch"><TermText text={lesson.arsenalCard.title} /></div>
            <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-parch/90"><TermText text={lesson.arsenalCard.body} /></pre>
          </div>
          <Button full onClick={() => nav('/')}>В Дом</Button>
        </div>
      )}

      {/* «Не понял» — другой способ объяснить */}
      {phase !== 'why' && phase !== 'report' && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 px-4 pt-3 backdrop-blur">
          <div className="mx-auto max-w-2xl"><Button variant="ghost" full onClick={openHelp}>Не понял</Button></div>
        </div>
      )}
      {sheetOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={() => setSheetOpen(false)}>
          <div className="pb-safe animate-rise max-h-[80dvh] w-full overflow-y-auto surface rounded-t-3xl border-t border-gold/40 px-4 pt-5 md:mx-auto md:max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <div className="space-y-3">
              {helpItems.slice(0, Math.max(helpIdx, 1)).filter((h) => h.kind !== 'reveal').map((h, i) => (
                <div key={i} className="rounded-xl bg-white/[0.05] p-4">
                  <Label>{h.kind === 'analogy' ? 'Простыми словами' : `Подсказка советника`}</Label>
                  <p className="mt-1 text-[16px] leading-relaxed"><TermText text={h.text} /></p>
                </div>
              ))}
              {phase === 'demo' && helpIdx >= helpItems.length && (
                <Button variant="ghost" full onClick={() => { setDemoIdx(0); setSheetOpen(false) }}>Посмотреть разбор с начала</Button>
              )}
              {helpIdx < helpItems.length && (
                <Button variant="ghost" full onClick={nextHelp}>
                  {helpItems[helpIdx].kind === 'reveal' ? 'Показать решение' : 'Объясни иначе'}
                </Button>
              )}
              {phase === 'solo' && <p className="text-center text-[12px] text-muted">С подсказками урок засчитывается, но Капитала — половина.</p>}
              <Button full onClick={() => setSheetOpen(false)}>Понятно</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Missing({ onBack }: { onBack: () => void }) {
  return (
    <div className="pt-safe px-4">
      <p className="mt-10 text-muted">Этого урока пока нет в контенте.</p>
      <Button className="mt-4" onClick={onBack}>Назад</Button>
    </div>
  )
}
