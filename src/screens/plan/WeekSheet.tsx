import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Week } from '../../content/schema'
import { deadlineOf } from '../../game/plan'
import { lessonLocked, type WeekStatus } from '../../game/engine'
import type { Game } from '../../game/useGame'
import { BossToken } from '../../components/BossToken'
import { ContractCard } from '../../components/ContractCard'
import { MissionCard } from '../../components/MissionCard'
import { Grip, Sortable } from '../../components/Sortable'
import { Icon, Label } from '../../components/ui'
import { bossState } from './bossState'

const fmtDate = (k: string) => new Date(k).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

/** Нижняя шторка с содержанием недели: уроки (их можно переставлять), босс, переговоры, миссии и контракт. */
export function WeekSheet({ game, s, onClose, onReorder }: { game: Game; s: WeekStatus; onClose: () => void; onReorder: (weekKey: number, ids: string[]) => void }) {
  const nav = useNavigate()
  const c = game.content
  const p = game.player!
  const w: Week = s.week
  const key = w.key ?? w.n
  const state = bossState(s, game)
  // Порядок уроков меняется только в админ-панели (после ввода её PIN)
  const isAdmin = sessionStorage.getItem('dynasty-admin') === '1'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/65 md:items-center md:justify-center" onClick={onClose}>
      <div className="animate-rise relative w-full md:max-w-2xl">
      <div className="ws-boss" data-state={state}>
        <BossToken art={w.bossId ?? w.negotiationId ?? null} state={state} woke={false} title={w.bossTitle} />
      </div>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Неделя ${w.n}: ${w.title}`}
        className="pb-safe max-h-[80dvh] md:max-h-[86dvh] w-full overflow-y-auto rounded-t-3xl border-t border-gold/40 px-4 pt-4 md:rounded-3xl md:border"
        style={{ background: 'linear-gradient(180deg, rgba(31,31,37,0.99), rgba(16,16,19,0.995))', backdropFilter: 'blur(18px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line md:hidden" />
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[15px] font-semibold ${s.complete ? 'border-gain bg-gain/10 text-gain' : 'border-gold bg-gold/15 text-gold-soft'}`}>
            {s.complete ? <Icon name="check" size={18} /> : w.n}
          </span>
          <div className="min-w-0 flex-1">
            <Label>{w.act}</Label>
            <div className="font-serif text-[22px] leading-snug">{w.title}</div>
            <div className="mt-0.5 text-[12px] text-muted">
              до {fmtDate(deadlineOf(w, p.startedAt, p.planOffsetWeeks))} · {s.lessonsTotal ? `уроки ${s.lessonsDone}/${s.lessonsTotal}` : 'уроки готовятся'}
              {s.locked ? ' · откроется после предыдущей недели' : ''}
              {s.missions.length ? ` · миссии ${s.missionsDone}/${s.missions.length}` : ''}{s.contractDone ? ' · контракт ✓' : ''}
            </div>
          </div>
          <button onClick={onClose} aria-label="Закрыть" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted active:bg-panel"><Icon name="close" /></button>
        </div>

        <div className="mt-4 space-y-2 pb-4">
          {w.lessonIds.length > 0 && (
            <Sortable
              className="space-y-2"
              items={w.lessonIds}
              keyOf={(id) => id}
              onChange={(ids) => onReorder(key, ids)}
              render={(id, i, h) => {
                const l = c.lessons[id]
                const pr = game.st.progress.get(id)
                const closed = lessonLocked(id, c, game.st)
                return (
                  <div className={`flex items-center gap-2 rounded-xl bg-white/[0.05] pl-1 ${closed ? 'opacity-50' : ''}`}>
                    {isAdmin ? <span {...h.handle} className="flex h-11 w-8 items-center justify-center"><Grip /></span> : <span className="w-3" />}
                    <button disabled={closed} onClick={() => nav(`/lesson/${id}`)} className="flex flex-1 items-center gap-3 py-3 pr-3 text-left">
                      <span className={pr ? 'text-gain' : 'text-muted'}>{pr ? <Icon name="check" size={18} /> : closed ? <Icon name="lock" size={18} /> : <span className="inline-block w-[18px] text-center text-[13px]">{i + 1}</span>}</span>
                      <span className="flex-1 text-[14px]">{l.title}</span>
                      {pr?.status === 'done_with_hints' && <span className="text-[11px] text-muted">с подсказками</span>}
                    </button>
                  </div>
                )
              }}
            />
          )}
          {s.bossReady && (
            <button disabled={!s.bossUnlocked} onClick={() => nav(`/boss/${w.bossId}`)} className="choice flex w-full items-center gap-3 rounded-xl border border-ruby/30 bg-ruby/[0.07] px-3 py-3 text-left disabled:opacity-50">
              <span className={s.bossDone ? 'text-gain' : 'text-gold'}>{s.bossDone ? <Icon name="check" size={18} /> : s.bossUnlocked ? <Icon name="shield" size={18} /> : <Icon name="lock" size={18} />}</span>
              <span className="flex-1 text-[14px]">Босс: {c.bosses[w.bossId!].title}</span>
            </button>
          )}
          {w.negotiationId && c.negotiations[w.negotiationId] && (
            <button disabled={!s.bossUnlocked} onClick={() => nav(`/negotiation/${w.negotiationId}`)} className="choice flex w-full items-center gap-3 rounded-xl border border-copper/40 bg-copper/[0.07] px-3 py-3 text-left disabled:opacity-50">
              <span className={s.bossUnlocked && game.negotiations.has(w.negotiationId) ? 'text-gain' : 'text-gold'}>{!s.bossUnlocked ? <Icon name="lock" size={18} /> : game.negotiations.has(w.negotiationId) ? <Icon name="check" size={18} /> : <Icon name="council" size={18} />}</span>
              <span className="flex-1 text-[14px]">Переговоры: {c.negotiations[w.negotiationId].title}</span>
              {!s.bossUnlocked && <span className="text-[11px] text-muted">после уроков</span>}
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
      </div>
      </div>
    </div>
  )
}
