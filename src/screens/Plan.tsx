import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { content as baseContent } from '../content'
import { savePlan, weekStatus } from '../game/engine'
import { deadlineOf } from '../game/plan'
import type { Game } from '../game/useGame'
import { ContractCard } from '../components/ContractCard'
import { MissionCard } from '../components/MissionCard'
import { Grip, Sortable } from '../components/Sortable'
import { Button, Icon, Label, Title } from '../components/ui'
import { PlanEditor } from './plan/PlanEditor'

const fmtDate = (k: string) => new Date(k).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

export default function Plan({ game }: { game: Game }) {
  const nav = useNavigate()
  const c = game.content
  const p = game.player!
  const [open, setOpen] = useState<number | null>(game.focus?.week.key ?? 1)
  const [pinAsk, setPinAsk] = useState(false)
  const [pin, setPin] = useState('')
  const [pinErr, setPinErr] = useState(false)
  const [editing, setEditing] = useState(false)
  const statuses = c.weeks.map((w) => weekStatus(w, c, game.st))
  const focusKey = game.focus?.week.key

  if (editing) return <PlanEditor game={game} onClose={() => setEditing(false)} />

  // Игрок меняет порядок уроков внутри недели без PIN
  async function reorderLessons(weekKey: number, lessonIds: string[]) {
    await savePlan(c.weeks.map((w) => ((w.key ?? w.n) === weekKey ? { ...w, lessonIds } : w)), c.missions, baseContent.weeks, baseContent.missions)
  }
  function checkPin() {
    if (pin === (game.settings.mentorPin || '0000')) { setEditing(true); setPinAsk(false); setPin(''); setPinErr(false) } else setPinErr(true)
  }

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <Title>План на {c.weeks.length} недель</Title>
        <p className="mt-1 text-[14px] text-muted">
          По плану сейчас неделя {game.weekNow}{p.planOffsetWeeks ? ` · план растянут на ${p.planOffsetWeeks} нед.` : ''}. Порядок уроков внутри недели можно менять — тяни за ⋮⋮.
        </p>
        <button onClick={() => setPinAsk(true)} className="mt-2 text-[14px] text-gold underline-offset-4 active:underline">Редактор плана (наставник) ›</button>
      </div>

      {statuses.map((s, idx) => {
        const w = s.week
        const key = w.key ?? w.n
        const isOpen = open === key
        const isFocus = key === focusKey
        const newAct = idx === 0 || statuses[idx - 1].week.act !== w.act
        return (
          <section key={key} className={newAct ? 'space-y-2 pt-2' : 'space-y-2'}>
            {newAct && <Label>{w.act}</Label>}
            <div className={`rounded-2xl border ${isFocus ? 'border-gold/60' : 'border-line'} bg-panel`}>
              <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(isOpen ? null : key)}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[14px] font-semibold ${s.complete ? 'border-gain text-gain' : isFocus ? 'border-gold text-gold' : 'border-line text-muted'}`}>
                  {s.complete ? <Icon name="check" size={18} /> : w.n}
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] leading-snug">{w.title}</span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    до {fmtDate(deadlineOf(w, p.startedAt, p.planOffsetWeeks))} · {s.lessonsTotal ? `уроки ${s.lessonsDone}/${s.lessonsTotal}` : 'уроки готовятся'}
                    {s.missions.length ? ` · миссии ${s.missionsDone}/${s.missions.length}` : ''}{s.contractDone ? ' · контракт ✓' : ''}
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-line p-4">
                  {w.lessonIds.length > 0 && (
                    <Sortable
                      className="space-y-2"
                      items={w.lessonIds}
                      keyOf={(id) => id}
                      onChange={(ids) => reorderLessons(key, ids)}
                      render={(id, i, h) => {
                        const l = c.lessons[id]
                        const pr = game.st.progress.get(id)
                        return (
                          <div className="flex items-center gap-2 rounded-xl bg-panel2 pl-1">
                            <span {...h.handle} className="flex h-11 w-8 items-center justify-center"><Grip /></span>
                            <button onClick={() => nav(`/lesson/${id}`)} className="flex flex-1 items-center gap-3 py-3 pr-3 text-left">
                              <span className={pr ? 'text-gain' : 'text-muted'}>{pr ? <Icon name="check" size={18} /> : <span className="inline-block w-[18px] text-center text-[13px]">{i + 1}</span>}</span>
                              <span className="flex-1 text-[14px]">{l.title}</span>
                              {pr?.status === 'done_with_hints' && <span className="text-[11px] text-muted">с подсказками</span>}
                            </button>
                          </div>
                        )
                      }}
                    />
                  )}
                  {s.bossReady && (
                    <button disabled={!s.bossUnlocked} onClick={() => nav(`/boss/${w.bossId}`)} className="flex w-full items-center gap-3 rounded-xl bg-panel2 px-3 py-3 text-left active:bg-line disabled:opacity-50">
                      <span className={s.bossDone ? 'text-gain' : 'text-gold'}>{s.bossDone ? <Icon name="check" size={18} /> : s.bossUnlocked ? <Icon name="shield" size={18} /> : <Icon name="lock" size={18} />}</span>
                      <span className="flex-1 text-[14px]">Босс: {c.bosses[w.bossId!].title}</span>
                    </button>
                  )}
                  {w.negotiationId && c.negotiations[w.negotiationId] && (
                    <button onClick={() => nav(`/negotiation/${w.negotiationId}`)} className="flex w-full items-center gap-3 rounded-xl border border-gold/30 bg-panel2 px-3 py-3 text-left active:bg-line">
                      <span className={game.negotiations.has(w.negotiationId) ? 'text-gain' : 'text-gold'}>{game.negotiations.has(w.negotiationId) ? <Icon name="check" size={18} /> : <Icon name="council" size={18} />}</span>
                      <span className="flex-1 text-[14px]">Переговоры: {c.negotiations[w.negotiationId].title}</span>
                      <span className="text-[11px] text-muted">открыто всегда</span>
                    </button>
                  )}
                  {!s.bossReady && !(w.negotiationId && c.negotiations[w.negotiationId]) && w.bossTitle !== '—' && <p className="px-1 text-[13px] text-muted">Босс недели: {w.bossTitle} — готовится.</p>}
                  {w.resource && (
                    <p className="px-1 text-[13px] text-muted">
                      Источник недели: {w.resource.url ? <a className="text-gold underline" href={w.resource.url} target="_blank" rel="noreferrer">{w.resource.title}</a> : w.resource.title}
                    </p>
                  )}
                  {s.missions.map((m) => <MissionCard key={m.id} mission={m} result={game.st.missions.get(m.id)} />)}
                  <ContractCard week={w} result={game.st.contracts.get(key)} />
                </div>
              )}
            </div>
          </section>
        )
      })}

      {pinAsk && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={() => setPinAsk(false)}>
          <div className="pb-safe animate-rise w-full rounded-t-3xl border-t border-gold/40 bg-panel px-5 pt-5" onClick={(e) => e.stopPropagation()}>
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
