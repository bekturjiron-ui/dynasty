import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { content } from '../content'
import { resolveTable, withVars } from '../content/scope'
import { completeBoss, weekStatus } from '../game/engine'
import { isAdmin } from '../game/admin'
import { jitterVars } from '../game/jitter'
import { planWeekN } from '../game/plan'
import { useGame } from '../game/useGame'
import type { Scope } from '../lib/expr'
import { render } from '../lib/template'
import { ExerciseView } from '../components/ExerciseView'
import { BossDefeatAnim } from '../components/BossDefeatAnim'
import { TermText } from '../components/Glossary'
import { LockedGate } from '../components/LockedGate'
import { TableView } from '../components/TableView'
import { Advisor, Button, Icon, Label } from '../components/ui'

export default function BossScreen() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const game = useGame()
  const boss = content.bosses[id]
  const [scope, setScope] = useState<Scope | null>(null)
  const [run, setRun] = useState(0)
  const [round, setRound] = useState(0)
  const [lives, setLives] = useState(3)
  const [attempts, setAttempts] = useState(0)
  const [result, setResult] = useState<null | 'won' | 'lost'>(null)
  const [gain, setGain] = useState<{ capital: number; xp: number } | null>(null)
  const lostTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (lostTimer.current) clearTimeout(lostTimer.current) }, [])

  if (!boss) return <div className="pt-safe px-4 text-muted">Босс этой недели ещё готовится.</div>
  if (game.loading) return null
  const bossWeek = game.content.weeks.find((w) => w.bossId === boss.id)
  const gate = bossWeek && weekStatus(bossWeek, game.content, game.st)
  if (gate && !gate.bossUnlocked) return <LockedGate done={gate.lessonsDone} total={gate.lessonsTotal} />
  const real = game.scope
  const sc = scope ?? withVars(real, boss.vars)

  function restart() {
    if (lostTimer.current) clearTimeout(lostTimer.current)
    setScope(jitterVars(withVars(real, boss.vars), boss.jitter))
    setRun((r) => r + 1)
    setRound(0)
    setLives(3)
    setResult(null)
  }
  async function solved(n: number) {
    if (lives <= 0) return // жизни кончились: попытка уже проиграна
    const total = attempts + n
    setAttempts(total)
    if (round < boss.rounds.length - 1) { setRound((r) => r + 1); return }
    setGain(await completeBoss(content, boss.id, total, lives))
    setResult('won')
  }
  function off() {
    setLives((l) => {
      const left = l - 1
      if (left <= 0 && !lostTimer.current) lostTimer.current = setTimeout(() => { lostTimer.current = null; setResult('lost') }, 900)
      return left
    })
  }

  async function adminSkip() {
    if (lostTimer.current) clearTimeout(lostTimer.current)
    setGain(await completeBoss(content, boss.id, boss.rounds.length, lives))
    setResult('won')
  }

  return (
    <div className="scene-boss pt-safe mx-auto min-h-dvh max-w-2xl px-4 pb-16 md:pt-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button onClick={() => nav(-1)} aria-label="Закрыть" className="flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-panel"><Icon name="close" /></button>
        <div className="flex items-center gap-3">
          {!result && isAdmin() && (
            <button
              type="button"
              onClick={adminSkip}
              title="Админ: сразу победить босса с наградой"
              className="min-h-8 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold text-gold-soft transition-colors hover:bg-gold/20 active:scale-95"
            >
              Скип
            </button>
          )}
          <div className="flex gap-1.5" aria-label={`Жизней: ${lives}`}>
            {[0, 1, 2].map((i) => (
              <span key={`${i}-${i < lives}`} className={i < lives ? 'text-gold-soft drop-shadow-[0_0_6px_rgba(232,205,114,0.5)]' : 'life-lost text-line'}><Icon name="shield" size={22} /></span>
            ))}
          </div>
        </div>
      </div>
      <Label tone="boss">Босс недели {planWeekN(game.content.weeks, (w) => w.bossId === boss.id, boss.week)}</Label>
      <h1 className="mt-1 font-serif text-[26px] leading-tight"><TermText text={boss.title} /></h1>

      {!result && (
        <div className="mt-4 space-y-4">
          <p className="text-[16px] leading-relaxed text-parch/90"><TermText text={render(boss.story, sc)} /></p>
          {boss.table && <TableView grid={resolveTable(boss.table, sc)} showFormulaBar={false} />}
          <div className="text-[13px] text-muted">Раунд {round + 1} из {boss.rounds.length}</div>
          <ExerciseView key={`${run}-${round}`} ex={boss.rounds[round]} scope={sc} mode="solo" onOff={off} onSolved={(r) => solved(r.attempts)} doneLabel={round < boss.rounds.length - 1 ? 'Следующий раунд' : 'Добить босса'} />
        </div>
      )}

      {result === 'won' && (
        <div className="animate-rise mt-5 space-y-4 text-center">
          <BossDefeatAnim bossId={boss.id} title={boss.title} />
          <p className="font-serif text-[24px]">Вылазка удалась</p>
          <Advisor tone="gain">
            {gain && gain.capital ? <>В казну: <b className="text-gold">+{gain.capital} ₸ Капитала</b>, <b className="text-gold">+{gain.xp} XP</b>. Жизней осталось: {lives}.</> : <>Босс повержен снова. Награда за него уже в казне, но день засчитан.</>}
          </Advisor>
          <Button full onClick={() => nav('/')}>В Дом</Button>
        </div>
      )}

      {result === 'lost' && (
        <div className="animate-rise mt-8 space-y-4">
          <Advisor>
            Вылазка не удалась — так бывает. Прогресс недели на месте, уроки и Арсенал никуда не делись. Босс вернётся с другими цифрами: каждая попытка — тренировка.
          </Advisor>
          <Button full onClick={restart}>Новая вылазка</Button>
          <Button variant="quiet" full onClick={() => nav('/arsenal')}>Заглянуть в Арсенал</Button>
        </div>
      )}
    </div>
  )
}
