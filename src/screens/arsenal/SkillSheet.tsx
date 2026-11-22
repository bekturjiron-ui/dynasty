import { useNavigate } from 'react-router-dom'
import { content as baseContent } from '../../content'
import type { ArsenalSkill } from '../../content/schema'
import type { Game } from '../../game/useGame'
import { GROUPS, LEVEL_NAMES, skillState } from '../../game/skills'
import { Bar, Icon, Label } from '../../components/ui'
import { SkillRing } from './SkillCard'

/** Окно навыка: всё про навык в одном месте. Уроки открываются тапом, формулы лежат здесь же. */
export function SkillSheet({ skill, game, onClose }: { skill: ArsenalSkill; game: Game; onClose: () => void }) {
  const nav = useNavigate()
  const c = game.content
  const g = GROUPS[skill.group]
  const s = skillState(skill, c, game.st)
  const owned = baseContent.empire.buildings.filter((b) => b.skills.some((bs) => bs.weeks.some((k) => skill.weeks.includes(k))))
  const doneLessons = s.statuses.flatMap((x) => x.week.lessonIds).filter((id) => game.st.progress.has(id) && c.lessons[id])

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60 md:items-center md:justify-center" onClick={onClose} role="dialog" aria-label={skill.title}>
      <div className="pb-safe animate-rise surface max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border-t border-gold/40 px-5 pt-3 md:max-w-xl md:rounded-3xl md:border md:pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center gap-4">
          <SkillRing ratio={s.ratio} color={g.ring} size={76}>
            <span className={g.text}><Icon name={skill.icon} size={30} /></span>
          </SkillRing>
          <div className="min-w-0 flex-1">
            <div className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${g.text}`}>{g.label}</div>
            <div className="font-serif text-[24px] leading-tight">{skill.title}</div>
            <div className="mt-0.5 text-[13px] text-muted">Уровень {s.level}: {LEVEL_NAMES[s.level]}</div>
          </div>
          <button onClick={onClose} aria-label="Закрыть" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted active:bg-panel"><Icon name="close" /></button>
        </div>

        <div className="mt-4">
          <Bar value={s.ratio} />
          <div className="mt-1 text-[12px] text-muted">{s.total ? `${s.done} из ${s.total} уроков` : 'Уроки этого навыка готовятся'}</div>
        </div>

        <p className="mt-4 text-[15px] leading-relaxed">{skill.description}</p>

        <div className="mt-5">
          <Label>После освоения ты сможешь</Label>
          <ul className="mt-2 space-y-2">
            {skill.outcomes.map((o) => (
              <li key={o} className="flex gap-2 text-[14px] leading-snug"><span className={`mt-0.5 shrink-0 ${g.text}`}><Icon name="check" size={16} /></span>{o}</li>
            ))}
          </ul>
        </div>

        <div className="mt-5 space-y-3">
          <Label>Уроки и задания</Label>
          {s.statuses.map(({ week, ...st }) => (
            <div key={week.key ?? week.n} className="rounded-xl bg-white/[0.05] p-3">
              <div className="text-[12px] text-muted">Неделя {week.n}</div>
              <div className="text-[14px] leading-snug">{week.title}</div>
              <div className="mt-2 space-y-1">
                {week.lessonIds.filter((id) => c.lessons[id]).map((id) => {
                  const done = game.st.progress.has(id)
                  return (
                    <button key={id} onClick={() => nav(`/lesson/${id}`)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-[14px] active:bg-white/10">
                      <span className={done ? 'text-gain' : 'text-muted'}>{done ? <Icon name="check" size={16} /> : <span className="inline-block h-4 w-4 rounded-full border border-line" />}</span>
                      <span className={done ? '' : 'text-parch/90'}>{c.lessons[id].title}</span>
                    </button>
                  )
                })}
                {st.bossReady && <div className="flex items-center gap-2 px-2 py-1 text-[13px] text-muted"><span className={st.bossDone ? 'text-gain' : ''}><Icon name={st.bossDone ? 'check' : 'shield'} size={16} /></span>Босс: {c.bosses[week.bossId!].title}</div>}
                <div className="flex items-center gap-2 px-2 py-1 text-[13px] text-muted"><span className={st.contractDone ? 'text-gain' : ''}><Icon name={st.contractDone ? 'check' : 'lock'} size={16} /></span>Реальный контракт</div>
              </div>
            </div>
          ))}
        </div>

        {doneLessons.length > 0 && (
          <div className="mt-5 space-y-3">
            <Label>Формулы и правила из Арсенала</Label>
            {doneLessons.map((id) => (
              <div key={id} className="rounded-xl bg-white/[0.05] p-3">
                <div className={`font-serif text-[17px] ${g.text}`}>{c.lessons[id].arsenalCard.title}</div>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-[14px] leading-relaxed text-parch/90">{c.lessons[id].arsenalCard.body}</pre>
              </div>
            ))}
          </div>
        )}

        {owned.length > 0 && (
          <div className="mt-5">
            <Label>Питает постройки Империи</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {owned.map((b) => <button key={b.id} onClick={() => nav('/empire')} className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[13px] text-gold-soft">{b.title}</button>)}
            </div>
          </div>
        )}

        <button onClick={onClose} className="mt-6 min-h-12 w-full rounded-xl text-[15px] text-muted active:bg-white/10">Закрыть</button>
      </div>
    </div>
  )
}
