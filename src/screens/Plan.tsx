import { useState } from 'react'
import { content as baseContent } from '../content'
import { savePlan, weekStatus } from '../game/engine'
import type { Game } from '../game/useGame'
import { PlanEmbers } from '../components/PlanEmbers'
import { ProjectCard } from '../components/ProjectCard'
import { Button, Title } from '../components/ui'
import { PlanEditor } from './plan/PlanEditor'
import { PlanMap } from './plan/PlanMap'
import { WeekSheet } from './plan/WeekSheet'

export default function Plan({ game }: { game: Game }) {
  const c = game.content
  const p = game.player!
  const [openKey, setOpenKey] = useState<number | null>(null)
  const [pinAsk, setPinAsk] = useState(false)
  const [pin, setPin] = useState('')
  const [pinErr, setPinErr] = useState(false)
  const [editing, setEditing] = useState(false)
  const statuses = c.weeks.map((w) => weekStatus(w, c, game.st))
  const focusKey = game.focus?.week.key
  const opened = statuses.find((s) => (s.week.key ?? s.week.n) === openKey)

  if (editing) return <PlanEditor game={game} onClose={() => setEditing(false)} />

  // Игрок меняет порядок уроков внутри недели без PIN
  async function reorderLessons(weekKey: number, lessonIds: string[]) {
    await savePlan(c.weeks.map((w) => ((w.key ?? w.n) === weekKey ? { ...w, lessonIds } : w)), c.missions, baseContent.weeks, baseContent.missions)
  }
  function checkPin() {
    if (pin === (game.settings.mentorPin || '0000')) { setEditing(true); setPinAsk(false); setPin(''); setPinErr(false) } else setPinErr(true)
  }

  return (
    <div className="stagger space-y-6">
      <div className="pt-2">
        <Title>План на {c.weeks.length} недель</Title>
        <p className="mt-1 text-[14px] text-muted">
          По плану сейчас неделя {game.weekNow}{p.planOffsetWeeks ? ` · план растянут на ${p.planOffsetWeeks} нед.` : ''}. Нажми на пункт карты, чтобы открыть неделю. Босс просыпается, когда пройдены все уроки недели.
        </p>
        <button onClick={() => setPinAsk(true)} className="mt-2 text-[14px] text-gold underline-offset-4 active:underline">Редактор плана (наставник) ›</button>
      </div>

      <ProjectCard weeks={c.weeks} contracts={game.st.contracts} onOpen={setOpenKey} />

      <PlanMap game={game} statuses={statuses} focusKey={focusKey} onOpen={setOpenKey} />

      {opened && <WeekSheet game={game} s={opened} onClose={() => setOpenKey(null)} onReorder={reorderLessons} />}
      <PlanEmbers paused={!!opened || pinAsk} />

      {pinAsk && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setPinAsk(false)}>
          <div className="pb-safe animate-rise w-full surface rounded-t-3xl border-t border-gold/40 px-5 pt-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <div className="font-serif text-[22px]">Редактор плана</div>
            <p className="mt-1 text-[14px] text-muted">Только для наставника. Введи PIN.</p>
            <input
              autoFocus inputMode="numeric" type="password" value={pin} maxLength={8}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinErr(false) }}
              onKeyDown={(e) => e.key === 'Enter' && checkPin()}
              className={`mt-3 min-h-12 w-full rounded-xl border bg-ink px-4 text-center text-[22px] tracking-[0.5em] outline-none ${pinErr ? 'border-loss' : 'border-line focus:border-gold'}`}
            />
            {pinErr && <p className="mt-2 text-[13px] text-loss">PIN не подходит.</p>}
            <div className="mt-4 space-y-2">
              <Button full onClick={checkPin} disabled={!pin}>Открыть</Button>
              <Button variant="quiet" full onClick={() => setPinAsk(false)}>Отмена</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
