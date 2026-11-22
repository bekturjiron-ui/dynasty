import { useNavigate } from 'react-router-dom'
import { content, contentError } from '../content'
import type { Game } from '../game/useGame'
import { fmtNum } from '../lib/format'
import { dayKey, daysBetween } from '../lib/dates'
import { rivalCurve, rivalXpAt } from '../game/rival'
import { ContractCard } from '../components/ContractCard'
import { MissionCard } from '../components/MissionCard'
import { Bar, Button, Card, Icon, Label, Sparks, useCountUp } from '../components/ui'

export default function Today({ game }: { game: Game }) {
  const nav = useNavigate()
  const { player, streak, focus, rank, st, weekNow } = game
  const plan = game.content
  const xpShown = useCountUp(player?.xp ?? 0)
  const capShown = useCountUp(player?.capital ?? 0)
  if (!player || !focus || !rank) return null

  const lesson = focus.nextLessonId ? content.lessons[focus.nextLessonId] : undefined
  const boss = focus.week.bossId ? content.bosses[focus.week.bossId] : undefined
  const heir = streak.lastDay && streak.daysAway > 3
  const lastDone = [...st.progress.values()].sort((a, b) => b.at.localeCompare(a.at))[0]
  const review = lastDone ? content.lessons[lastDone.lessonId] : undefined

  return (
    <div className="stagger space-y-4">
      {contentError && <Card className="border-loss/60 text-[13px] text-loss">Контент не прошёл проверку: {contentError}</Card>}

      {/* Титул и ресурсы */}
      <div className="relative pt-2">
        <Sparks burst={player.xp} />
        <Label tone="gold">{player.houseName}</Label>
        <h1 className="gold-text mt-1 font-serif text-[38px] leading-none">{rank.rank?.title}</h1>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted">
          <span><b className="text-parch">{fmtNum(capShown)}</b> ₸ Капитала</span>
          <span><b className="text-gold-soft">{fmtNum(xpShown)}</b> XP</span>
          <span>Репутация <b className="text-parch">{player.reputation}</b></span>
        </div>
        {(() => {
          const lead = player.xp - rivalXpAt(rivalCurve(plan), daysBetween(player.startedAt, dayKey()) + 1, player.planOffsetWeeks ?? 0)
          return (
            <button onClick={() => nav('/empire')} className="mt-2 text-left text-[13px] text-muted">
              {content.empire.rival.name}: {lead >= 0 ? <span className="text-gain">ты впереди на {fmtNum(lead)} XP</span> : <span className="text-loss">впереди тебя на {fmtNum(-lead)} XP</span>} ›
            </button>
          )
        })()}
      </div>

      {rank.next && (
        <Card>
          <div className="flex items-baseline justify-between">
            <Label>Следующий титул</Label>
            <span className="font-serif text-[16px] text-gold">{rank.next.title}</span>
          </div>
          <Bar value={rank.ratio} className="mt-2" />
          <p className="mt-2 text-[13px] text-muted">
            {rank.rank?.requirement}. {rank.need.length ? `Контракты недель: ${rank.need.map((k) => { const n = plan.weeks.find((w) => (w.key ?? w.n) === k)?.n ?? k; return st.contracts.has(k) ? `${n} ✓` : n }).join(', ')}.` : ''} Титул дают только за реальный результат.
          </p>
        </Card>
      )}

      {/* Серия со щитом */}
      <div className="flex gap-3">
        <Card className="flex flex-1 items-center gap-3">
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${streak.activeToday ? 'bg-gold/15 text-gold-soft' : 'bg-white/5 text-muted'}`}><span className={streak.activeToday ? 'animate-flame' : 'inline-flex'}><Icon name="flame" size={28} /></span></span>
          <div>
            <div className="text-[24px] font-semibold leading-none">{streak.streak}</div>
            <div className="text-[12px] text-muted">{streak.activeToday ? 'день в деле, сегодня засчитан' : 'дней в деле · сделай урок сегодня'}</div>
          </div>
        </Card>
        <Card className="flex w-[42%] items-center gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${streak.shieldUsedThisWeek ? 'bg-white/5 text-muted' : 'bg-gold/15 text-gold-soft'}`}><span className="animate-shield"><Icon name="shield" size={26} /></span></span>
          <div className="text-[12px] leading-snug text-muted">{streak.shieldUsedThisWeek ? 'Щит недели потрачен' : 'Щит на месте: один пропуск не собьёт серию'}</div>
        </Card>
      </div>

      {heir && review && (
        <Card tone="gold">
          <Label tone="gold">Возвращение наследника</Label>
          <p className="mt-1 text-[15px] leading-relaxed">Дом ждал {streak.daysAway} дн. Вспомним последнее и разомнёмся лёгкой миссией — без давления.</p>
          <div className="mt-3 rounded-xl bg-panel2 p-3">
            <div className="font-serif text-[17px] text-gold">{review.arsenalCard.title}</div>
            <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-[14px] text-parch/90">{review.arsenalCard.body}</pre>
          </div>
          <Button variant="ghost" full className="mt-3" onClick={() => nav(`/lesson/${review.id}`)}>Лёгкая миссия: повторить «{review.title}»</Button>
        </Card>
      )}

      {/* Неделя */}
      <div className="pt-2">
        <Label>Неделя {focus.week.n}{focus.week.n < weekNow ? ` · догоняем (по плану идёт ${weekNow})` : focus.week.n > weekNow ? ' · на опережение' : ''}</Label>
        <div className="mt-1 font-serif text-[20px] leading-snug">{focus.week.title}</div>
      </div>

      {lesson ? (
        <Card tone="gold" className="p-5">
          <div className="flex items-center justify-between">
            <Label tone="gold">Урок дня · {focus.lessonsDone + 1} из {focus.lessonsTotal}</Label>
            <span className="text-[12px] text-muted">~10–15 мин</span>
          </div>
          <div className="mt-2 font-serif text-[24px] leading-snug">{lesson.title}</div>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{lesson.why}</p>
          <Button full className="mt-4" onClick={() => nav(`/lesson/${lesson.id}`)}>Начать</Button>
        </Card>
      ) : focus.lessonsTotal > 0 ? (
        <Card><p className="text-[15px]">{focus.complete ? 'Неделя закрыта: уроки, босс и контракт пройдены.' : 'Все уроки недели пройдены. Остались миссии.'}</p></Card>
      ) : (
        <Card><p className="text-[15px] text-muted">Уроки этой недели наставник ещё готовит. Пока — реальный контракт и повторение Арсенала.</p></Card>
      )}

      {/* Миссии: босс и контракт */}
      {boss && !focus.bossDone && (
        <Card tone={focus.bossUnlocked ? 'boss' : 'plain'} className={focus.bossUnlocked ? '' : 'opacity-70'}>
          <div className="flex items-center justify-between">
            <Label tone={focus.bossUnlocked ? 'boss' : undefined}>Босс недели · 3 жизни</Label>
            {!focus.bossUnlocked && <span className="text-muted"><Icon name="lock" size={18} /></span>}
          </div>
          <div className="mt-1 font-serif text-[19px]">{boss.title}</div>
          {focus.bossUnlocked
            ? <Button full className="mt-3" onClick={() => nav(`/boss/${boss.id}`)}>В вылазку</Button>
            : <p className="mt-1 text-[13px] text-muted">Откроется после уроков недели.</p>}
        </Card>
      )}
      {focus.missions.map((m) => <MissionCard key={m.id} mission={m} result={st.missions.get(m.id)} />)}
      <ContractCard week={focus.week} result={st.contracts.get(focus.week.key ?? focus.week.n)} />

      {content.productsAreDemo && (
        <p className="px-1 text-center text-[12px] text-muted">Цифры в уроках — демо-косметика. Наставник заменит их на товары Novelia.</p>
      )}
    </div>
  )
}
