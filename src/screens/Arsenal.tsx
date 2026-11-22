import { useState } from 'react'
import { content } from '../content'
import type { Game } from '../game/useGame'
import { Card, Label, Title } from '../components/ui'

export default function Arsenal({ game }: { game: Game }) {
  const [q, setQ] = useState('')
  const cards = [...game.st.progress.values()]
    .map((p) => content.lessons[p.lessonId])
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id))
  const needle = q.trim().toLowerCase()
  const shown = needle ? cards.filter((l) => `${l.arsenalCard.title} ${l.arsenalCard.body} ${l.title}`.toLowerCase().includes(needle)) : cards

  return (
    <div className="stagger space-y-4">
      <div className="pt-2">
        <Title>Арсенал</Title>
        <p className="mt-1 text-[14px] text-muted">Карточки остаются навсегда. Открыто: {cards.length}.</p>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: маржа, СУММ, $…" className="min-h-12 w-full rounded-xl border border-line bg-panel px-4 outline-none focus:border-gold" />
      {shown.length === 0 && <p className="text-[14px] text-muted">{cards.length ? 'Ничего не нашлось.' : 'Пройди первый урок — его формула ляжет сюда.'}</p>}
      {shown.map((l) => (
        <Card key={l.id}>
          <Label tone="gold">Неделя {l.week} · {l.title}</Label>
          <div className="mt-1 font-serif text-[20px] text-gold">{l.arsenalCard.title}</div>
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-parch/90">{l.arsenalCard.body}</pre>
        </Card>
      ))}
    </div>
  )
}
