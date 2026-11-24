import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { content } from '../content'
import { withVars } from '../content/scope'
import { loadReviewStats, loadReviewToday, pickReview, saveReviewResult } from '../game/review'
import type { Game } from '../game/useGame'
import { dayKey } from '../lib/dates'
import { ExerciseView } from './ExerciseView'
import { Button, Card, Icon, Label } from './ui'

/** «Разбор утра»: один вопрос в день из пройденных уроков, чаще из тех, где было трудно. */
export function MorningReview({ game }: { game: Game }) {
  const nav = useNavigate()
  const day = dayKey()
  const [done, setDone] = useState(() => loadReviewToday(day))
  const misses = useRef(0)
  const progress = game.st.progress
  const pick = useMemo(() => pickReview(content.lessons, progress, loadReviewStats(), day), [progress, day])

  if (!pick) return null
  // После ответа показываем тот же урок, из которого был вопрос, даже если список пройденных изменился
  const lesson = done ? content.lessons[done.lessonId] ?? pick.lesson : pick.lesson

  if (done && lesson) {
    return (
      <Card className="flex items-center gap-3">
        <span className="animate-check text-gain"><Icon name="check" size={22} /></span>
        <div className="min-w-0 flex-1">
          <Label>Разбор утра · готово</Label>
          <p className="mt-0.5 text-[14px] text-muted">{done.misses === 0 ? 'С первого раза.' : 'Прошёл с подсказками советника.'} Новый вопрос будет завтра.</p>
        </div>
        <button onClick={() => nav(`/lesson/${lesson.id}`)} className="shrink-0 text-[13px] text-gold underline-offset-4 active:underline">К уроку</button>
      </Card>
    )
  }

  const scope = withVars(game.scope, pick.lesson.vars)
  return (
    <Card tone="gold" className="space-y-3 p-5">
      <div>
        <Label tone="gold">Разбор утра</Label>
        <p className="mt-1 text-[13px] text-muted">Один вопрос из пройденного: «{pick.lesson.title}».</p>
      </div>
      <ExerciseView
        ex={pick.ex}
        scope={scope}
        mode="solo"
        doneLabel="Готово"
        onOff={() => { misses.current += 1 }}
        onSolved={() => { saveReviewResult(day, pick.lesson.id, misses.current); setDone({ day, lessonId: pick.lesson.id, misses: misses.current }) }}
      />
      <Button variant="quiet" full onClick={() => nav(`/lesson/${pick.lesson.id}`)}>Открыть урок целиком</Button>
    </Card>
  )
}
