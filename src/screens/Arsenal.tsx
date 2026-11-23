import { useMemo, useState } from 'react'
import type { Game } from '../game/useGame'
import { planWeekN } from '../game/plan'
import { GROUPS, skillState } from '../game/skills'
import { Card, Label, Title } from '../components/ui'
import { TERM_CATEGORIES, TermText, useGlossary } from '../components/Glossary'
import type { TermCategory } from '../content/schema'
import { SkillCard } from './arsenal/SkillCard'
import { SkillSheet } from './arsenal/SkillSheet'

type Tab = 'skills' | 'formulas' | 'glossary'

export default function Arsenal({ game }: { game: Game }) {
  const [tab, setTab] = useState<Tab>('skills')
  const [q, setQ] = useState('')
  const [termQ, setTermQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const { openTerm } = useGlossary()
  const c = game.content

  const skills = useMemo(() => c.skills.map((s) => ({ skill: s, state: skillState(s, c, game.st) })), [c, game.st])
  const open = skills.find((x) => x.skill.id === openId)
  const mastered = skills.filter((x) => x.state.level === 3).length
  const totalLevels = skills.reduce((s, x) => s + x.state.level, 0)

  const cards = [...game.st.progress.values()]
    .map((p) => c.lessons[p.lessonId])
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id))
  const needle = q.trim().toLowerCase()
  const shown = needle ? cards.filter((l) => `${l.arsenalCard.title} ${l.arsenalCard.body} ${l.title}`.toLowerCase().includes(needle)) : cards

  const termNeedle = termQ.trim().toLowerCase()
  const shownTerms = termNeedle
    ? c.glossary.filter((t) => `${t.term} ${t.full} ${t.ru} ${t.meaning} ${(t.aliases ?? []).join(' ')}`.toLowerCase().includes(termNeedle))
    : c.glossary

  return (
    <div className="stagger space-y-4">
      <div className="pt-2">
        <Title>Арсенал</Title>
        <p className="mt-1 text-[14px] text-parch/80">
          {tab === 'skills'
            ? `Навыков: ${skills.length} · освоено ${mastered} · очков уровня ${totalLevels} из ${skills.length * 3}`
            : tab === 'formulas'
              ? `Формулы и правила остаются навсегда. Открыто: ${cards.length}.`
              : `Термины курса (${c.glossary.length}). Нажимай на любой термин в уроках или ищи здесь.`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/30 p-1" role="tablist">
        {([['skills', 'Навыки'], ['formulas', 'Формулы'], ['glossary', 'Словарь']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-10 rounded-lg text-[14px] font-semibold transition-colors ${tab === k ? 'bg-gold/20 text-gold-soft' : 'text-muted'}`}>{label}</button>
        ))}
      </div>

      {tab === 'skills' && (
        <>
          {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((gk) => {
            const list = skills.filter((x) => x.skill.group === gk)
            if (!list.length) return null
            return (
              <section key={gk} className="space-y-2">
                <Label tone={gk === 'base' ? 'gold' : undefined}>{GROUPS[gk].label}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {list.map(({ skill, state }) => <SkillCard key={skill.id} skill={skill} state={state} onOpen={() => setOpenId(skill.id)} />)}
                </div>
              </section>
            )
          })}
        </>
      )}

      {tab === 'formulas' && (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: CPL, ROMI, хук…" className="surface min-h-12 w-full rounded-xl border border-line px-4 outline-none focus:border-gold" />
          {shown.length === 0 && <p className="text-[14px] text-parch/80">{cards.length ? 'Ничего не нашлось.' : 'Пройди первый урок — его формула ляжет сюда.'}</p>}
          {shown.map((l) => (
            <Card key={l.id}>
              <Label>Неделя {planWeekN(c.weeks, (w) => w.lessonIds.includes(l.id), l.week)} · {l.title}</Label>
              <div className="mt-1 font-serif text-[20px] text-gold"><TermText text={l.arsenalCard.title} /></div>
              <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-parch/90"><TermText text={l.arsenalCard.body} /></pre>
            </Card>
          ))}
        </>
      )}

      {tab === 'glossary' && (
        <>
          <input value={termQ} onChange={(e) => setTermQ(e.target.value)} placeholder="Поиск: KPI, CPC, CTR, CAPI, клик…" className="surface min-h-12 w-full rounded-xl border border-line px-4 outline-none focus:border-gold" />
          {shownTerms.length === 0 && <p className="text-[14px] text-parch/80">Ничего не нашлось.</p>}
          {(Object.keys(TERM_CATEGORIES) as TermCategory[]).map((cat) => {
            const list = shownTerms.filter((t) => t.category === cat)
            if (!list.length) return null
            return (
              <section key={cat} className="space-y-2">
                <Label tone={cat === 'metrics' ? 'gold' : undefined}>{TERM_CATEGORIES[cat]}</Label>
                <div className="space-y-2">
                  {list.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openTerm(t)}
                      className="choice surface w-full rounded-2xl border border-line px-4 py-3 text-left"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="font-serif text-[18px] text-gold-soft">{t.term}</span>
                        {t.full.toLowerCase() !== t.term.toLowerCase() && (
                          <span className="text-[13px] text-muted">— {t.full}</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[14px] text-parch/90">{t.ru}</div>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </>
      )}

      {open && <SkillSheet skill={open.skill} game={game} onClose={() => setOpenId(null)} />}
    </div>
  )
}
