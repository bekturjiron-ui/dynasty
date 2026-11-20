import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { content } from '../content'
import { resolveTable, withVars } from '../content/scope'
import { completeBoss } from '../game/engine'
import { jitterVars } from '../game/jitter'
import { useGame } from '../game/useGame'
import type { Scope } from '../lib/expr'
import { render } from '../lib/template'
import { ExerciseView } from '../components/ExerciseView'
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

  if (!boss) return <div className="pt-safe px-4 text-muted">Босс этой недели ещё готовится.</div>
  if (game.loading) return null
  const real = boss.useRealData ? game.scopeReal : game.scope
  const sc = scope ?? withVars(real, boss.vars)

  function restart() {
    setScope(jitterVars(withVars(real, boss.vars), boss.jitter))
    setRun((r) => r + 1)
    setRound(0)
    setLives(3)
    setResult(null)
  }
  async function solved(n: number) {
    const total = attempts + n
    setAttempts(total)
    if (round < boss.rounds.length - 1) { setRound((r) => r + 1); return }
    setGain(await completeBoss(content, boss.id, total, lives))
    setResult('won')
  }
  function off() {
    setLives((l) => {
      const left = l - 1
      if (left <= 0) setTimeout(() => setResult('lost'), 900)
      return left
    })
  }

  return (
    <div className="pt-safe min-h-dvh px-4 pb-16">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => nav(-1)} aria-label="Закрыть" className="flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-panel"><Icon name="close" /></button>
        <div className="flex gap-1.5" aria-label={`Жизней: ${lives}`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < lives ? 'text-gold' : 'text-line'}><Icon name="shield" size={22} /></span>
          ))}
        </div>
      </div>
      <Label>Босс недели {boss.week}</Label>
      <h1 className="mt-1 font-serif text-[26px] leading-tight">{boss.title}</h1>

      {!result && (
        <div className="mt-4 space-y-4">
          <p className="text-[16px] leading-relaxed text-parch/90">{render(boss.story, sc)}</p>
          {boss.table && <TableView grid={resolveTable(boss.table, sc)} showFormulaBar={false} />}
          <div className="text-[13px] text-muted">Раунд {round + 1} из {boss.rounds.length}</div>
          <ExerciseView key={`${run}-${round}`} ex={boss.rounds[round]} scope={sc} mode="solo" onOff={off} onSolved={(r) => solved(r.attempts)} doneLabel={round < boss.rounds.length - 1 ? 'Следующий раунд' : 'Добить босса'} />
        </div>
      )}

      {result === 'won' && (
        <div className="animate-rise mt-8 space-y-4 text-center">
          <div className="animate-crown mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-gold text-gold"><Icon name="check" size={48} /></div>
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
