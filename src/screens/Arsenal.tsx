import { useMemo, useState } from 'react'
import type { Game } from '../game/useGame'
import { GROUPS, skillState } from '../game/skills'
import { Card, Label, Title } from '../components/ui'
import { SkillCard } from './arsenal/SkillCard'
import { SkillSheet } from './arsenal/SkillSheet'

type Tab = 'skills' | 'formulas'

export default function Arsenal({ game }: { game: Game }) {
  const [tab, setTab] = useState<Tab>('skills')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
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

  return (
    <div className="stagger space-y-4">
      <div className="pt-2">
        <Title>Арсенал</Title>
        <p className="mt-1 text-[14px] text-parch/80">
          {tab === 'skills' ? `Навыков: ${skills.length} · освоено ${mastered} · очков уровня ${totalLevels} из ${skills.length * 3}` : `Формулы и правила остаются навсегда. Открыто: ${cards.length}.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1" role="tablist">
        {([['skills', 'Навыки'], ['formulas', 'Формулы']] as const).map(([k, label]) => (
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
                <Label tone={gk === 'kaspi' ? 'gold' : undefined}>{GROUPS[gk].label}</Label>
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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: маржа, СУММ, $…" className="surface min-h-12 w-full rounded-xl border border-line px-4 outline-none focus:border-gold" />
          {shown.length === 0 && <p className="text-[14px] text-parch/80">{cards.length ? 'Ничего не нашлось.' : 'Пройди первый урок — его формула ляжет сюда.'}</p>}
          {shown.map((l) => (
            <Card key={l.id}>
              <Label>Неделя {l.week} · {l.title}</Label>
              <div className="mt-1 font-serif text-[20px] text-gold">{l.arsenalCard.title}</div>
              <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-parch/90">{l.arsenalCard.body}</pre>
            </Card>
          ))}
        </>
      )}

      {open && <SkillSheet skill={open.skill} game={game} onClose={() => setOpenId(null)} />}
    </div>
  )
}
