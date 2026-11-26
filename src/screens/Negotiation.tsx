import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { content } from '../content'
import type { NegOption } from '../content/schema'
import { completeNegotiation, weekStatus } from '../game/engine'
import { isAdmin } from '../game/admin'
import { LockedGate } from '../components/LockedGate'
import { choose, COLD_LIMIT, negScope, outcome, startNeg, type NegOutcome, type NegState } from '../game/negotiation'
import { planWeekN } from '../game/plan'
import { useGame } from '../game/useGame'
import { fmtTg } from '../lib/format'
import { render } from '../lib/template'
import { TermText } from '../components/Glossary'
import { RewardPills } from '../components/Reward'
import { Advisor, Button, Icon, Label } from '../components/ui'

const BASE = import.meta.env.BASE_URL

type Line = { who: 'npc' | 'me' | 'note'; text: string; at: string; loyalty?: number }

const now = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
/** Сколько «печатает» партнёр: чем длиннее реплика, тем дольше, но не скучно. */
const typingMs = (text: string) => (reduced() ? 150 : Math.min(1800, 650 + text.length * 9))

/** Аватар партнёра: лицо из портрета public/art/bosses/<id>.webp, без картинки — буква имени. */
function Avatar({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className="relative shrink-0 overflow-hidden rounded-full border border-copper/60 bg-copper/10" style={{ width: size, height: size }}>
      {broken ? (
        <div className="flex h-full w-full items-center justify-center font-serif text-[18px] text-copper">{name[0]}</div>
      ) : (
        <img src={`${BASE}art/bosses/${id}.webp`} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" style={{ objectPosition: '50% 0%', transform: 'scale(2.6)', transformOrigin: '52% 14%' }} />
      )}
    </div>
  )
}

/** Две галочки «прочитано» у своих сообщений. */
function Ticks() {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden className="text-gold-soft">
      <path d="m1 5.5 3 3L10 2.5M6.5 8.5l.5.5L15 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function NegotiationScreen() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const game = useGame()
  const n = content.negotiations[id]
  const [st, setSt] = useState<NegState | null>(null)
  const [log, setLog] = useState<Line[]>([])
  const [typing, setTyping] = useState(false)
  const [result, setResult] = useState<{ o: NegOutcome; gain: { xp: number; influence: number; reputation: number } } | null>(null)
  const [copied, setCopied] = useState(false)
  const [saveErr, setSaveErr] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const base = game.loading ? null : game.scope
  const scope = useMemo(() => (n && base ? negScope(n, base, st ?? undefined) : null), [n, base, st])
  const nodes = useMemo(() => (n ? Object.fromEntries(n.nodes.map((x) => [x.id, x])) : {}), [n])

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [log.length, result, typing])

  if (!n) return <div className="pt-safe px-4 text-muted">Этих переговоров нет в контенте.</div>
  if (game.loading || !base || !scope) return null
  const negWeek = game.content.weeks.find((w) => w.negotiationId === n.id)
  const gate = negWeek && weekStatus(negWeek, game.content, game.st)
  if (gate && !gate.bossUnlocked) return <LockedGate done={gate.lessonsDone} total={gate.lessonsTotal} />

  /** Партнёр «печатает», потом приходят его реплики; then — что сделать после. */
  function reply(lines: Line[], then?: () => void) {
    const npcText = lines.filter((l) => l.who === 'npc').map((l) => l.text).join(' ')
    setTyping(true)
    timer.current = setTimeout(() => {
      timer.current = null
      setTyping(false)
      setLog((l) => [...l, ...lines.map((x) => ({ ...x, at: now() }))])
      then?.()
    }, typingMs(npcText))
  }

  function begin() {
    if (timer.current) clearTimeout(timer.current)
    const s = startNeg(n)
    setSt(s)
    setResult(null)
    setSaveErr(false)
    setLog([])
    reply([{ who: 'npc', text: render(nodes[s.node].npcLine, negScope(n, base!, s)), at: '' }])
  }

  function pick(o: NegOption) {
    if (!st || typing) return
    const next = choose(n, st, o)
    const sc = negScope(n, base!, next)
    setLog((l) => [...l, { who: 'me', text: render(o.text, negScope(n, base!, st)), at: now(), loyalty: next.loyalty - st.loyalty }])
    const lines: Line[] = []
    if (!next.end) {
      if (next.cold === 1) lines.push({ who: 'note', at: '', text: `${n.partner.name} отвечает суше. Если отношения не потеплеют, через 2 хода разговор закончится.` })
      if (next.cold === COLD_LIMIT - 1) lines.push({ who: 'note', at: '', text: `Последний шанс: ещё один холодный ход — и ${n.partner.name} уйдёт.` })
      if (st.cold > 0 && next.cold === 0) lines.push({ who: 'note', at: '', text: 'Лёд тронулся: отношения снова тёплые.' })
      lines.push({ who: 'npc', at: '', text: render(nodes[next.node].npcLine, sc) })
    } else if (next.end === 'left') {
      lines.push({ who: 'npc', at: '', text: 'Знаете, давайте на этом закончим. Удачи вам с другими блогерами.' })
    } else if (next.end === 'walkout') {
      lines.push({ who: 'npc', at: '', text: 'Извините, у меня следующая встреча. Вернёмся к разговору как-нибудь потом.' })
    } else if (next.end === 'deal') {
      lines.push({ who: 'npc', at: '', text: next.loyalty >= n.coldBelow ? `Договорились! ${fmtTg(sc.price as number)} за ролик, отправлю договор.` : `Хорошо. ${fmtTg(sc.price as number)} за ролик.` })
    }
    reply(lines, () => {
      setSt(next)
      if (next.end) void finish(next)
    })
  }

  async function finish(next: NegState) {
    const o2 = outcome(n, next, base!)
    let gain = { xp: 0, influence: 0, reputation: 0 }
    try {
      gain = await completeNegotiation(content, n.id, {
        end: next.end!, discount: next.discount, loyalty: next.loyalty, saving: o2.saving, xp: o2.xp, influence: o2.influence, reputation: o2.reputation,
      })
      setSaveErr(false)
    } catch {
      setSaveErr(true) // итог всё равно показываем, чтобы разговор не пропал
    }
    setResult({ o: o2, gain })
  }

  async function adminSkip() {
    if (timer.current) clearTimeout(timer.current)
    setTyping(false)
    const fin: NegState = {
      ...(st ?? startNeg(n)),
      end: 'deal',
      discount: Math.min(10, n.maxDiscountPct),
      loyalty: Math.max(n.loyalty, n.coldBelow + 20),
    }
    setSt(fin)
    await finish(fin)
  }

  const claudePrompt = `Сыграй роль ${n.partner.name}, ${n.partner.role} («${n.partner.company}»). Я таргетолог бренда косметики в Казахстане. Обсуждаем партнёрскую рекламу: сейчас ${fmtTg(scope.start as number)} за ролик, пакет из ${n.orders} роликов. У тебя есть скрытый минимум цены и терпение; на давление и грубость реагируй холоднее, на честные аргументы и выгоду для обеих сторон теплее. После 8–10 реплик выйди из роли и разбери мои переговоры: где я давил, где влиял, что можно было улучшить.`
  const status = typing ? 'печатает…' : st?.end === 'left' || st?.end === 'walkout' ? 'была в сети недавно' : 'в сети'
  const cold = st ? st.loyalty < n.coldBelow : false

  return (
    <div className="scene-copper mx-auto flex min-h-dvh max-w-2xl flex-col">
      {/* Шапка мессенджера + шкалы сделки */}
      <div className="pt-safe sticky top-0 z-20 border-b border-white/5 bg-[#17151a]/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 pb-2">
          <button onClick={() => nav(-1)} aria-label="Закрыть" className="flex h-10 w-9 shrink-0 items-center justify-center rounded-full text-muted active:bg-panel"><Icon name="close" /></button>
          <Avatar id={n.id} name={n.partner.name} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[16px] font-semibold">{n.partner.name}</div>
            <div className={`truncate text-[12px] ${typing ? 'text-gold-soft' : 'text-muted'}`}>{st ? status : `${n.partner.role}, «${n.partner.company}»`}</div>
          </div>
          {!result && isAdmin() && (
            <button
              type="button"
              onClick={adminSkip}
              title="Админ: завершить переговоры сделкой с наградой"
              className="min-h-8 shrink-0 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold text-gold-soft transition-colors hover:bg-gold/20 active:scale-95"
            >
              Скип
            </button>
          )}
        </div>
        {st && (
          <div className="grid grid-cols-2 gap-3 border-t border-white/5 px-4 py-2">
            <div>
              <div className="flex items-baseline justify-between gap-1 text-[11px]"><span className="text-muted">Цена</span><span className="tabular-nums text-parch">{fmtTg(scope.price as number)} <span className="text-gold">−{st.discount}%</span></span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"><div className="bar-shine h-full rounded-full bg-gradient-to-r from-[#9c7c17] to-gold-soft transition-[width] duration-500" style={{ width: `${Math.min(1, st.discount / 15) * 100}%` }} /></div>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-1 text-[11px]"><span className="text-muted">Лояльность</span><span className={`tabular-nums ${cold ? 'text-loss' : st.loyalty >= 70 ? 'text-gain' : 'text-parch'}`}>{st.loyalty}</span></div>
              <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                <div className={`h-full rounded-full transition-[width] duration-500 ${cold ? 'bg-loss' : 'bg-gain'}`} style={{ width: `${st.loyalty}%` }} />
                <div className="absolute top-0 h-full w-px bg-parch/50" style={{ left: `${n.coldBelow}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {!st && (
        <div className="animate-rise space-y-4 px-4 pt-4 pb-6">
          <Label tone="copper">Переговоры · неделя {planWeekN(game.content.weeks, (w) => w.negotiationId === n.id, n.week)}</Label>
          <h1 className="font-serif text-[26px] leading-tight"><TermText text={n.title} /></h1>
          <Advisor><TermText text={render(n.intro, scope)} /></Advisor>
          <p className="text-[14px] leading-relaxed text-muted">
            Сколько блогер может уступить, ты не знаешь. Видно цену и лояльность. Давление даёт скидку сейчас, но если партнёр остынет, через 2 хода разговор закончится, а замена стоит дороже. Итог считается на пакет из {n.orders} роликов.
          </p>
          <Button full onClick={begin}>Начать переписку</Button>
        </div>
      )}

      {st && (
        <div className="chat-wall flex-1 space-y-2 px-3 pt-3 pb-6">
          <div className="flex justify-center"><span className="chat-chip">Сегодня</span></div>
          <div className="flex justify-center"><span className="chat-chip max-w-[88%] text-center">Переписка о партнёрской рекламе: пакет из {n.orders} роликов. Сколько {n.partner.name} готова уступить — неизвестно.</span></div>

          {log.map((l, i) =>
            l.who === 'note' ? (
              <div key={i} className="animate-rise flex justify-center"><span className="chat-chip chat-chip-warn max-w-[88%] text-center">{l.text}</span></div>
            ) : (
              <div key={i} className={`chat-in flex flex-col ${l.who === 'me' ? 'items-end' : 'items-start'}`}>
                <div className={`chat-bubble ${l.who === 'me' ? 'chat-me' : 'chat-npc'} ${log[i - 1]?.who === l.who ? 'chat-cont' : ''}`}>
                  <TermText text={l.text} />
                  <span className="chat-meta">{l.at}{l.who === 'me' && <Ticks />}</span>
                </div>
                {l.who === 'me' && l.loyalty !== undefined && l.loyalty !== 0 && (
                  <span className={`mt-1 mr-1 rounded-full px-2 py-0.5 text-[11px] ${l.loyalty > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>лояльность {l.loyalty > 0 ? '+' : ''}{l.loyalty}</span>
                )}
              </div>
            ),
          )}

          {typing && (
            <div className="chat-in flex items-start">
              <div className="chat-bubble chat-npc chat-typing" aria-label={`${n.partner.name} печатает`}><i /><i /><i /></div>
            </div>
          )}

          {!st.end && !typing && log.length > 0 && (
            <div className="animate-rise pt-3">
              <div className="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">Твой ответ</div>
              <div className="space-y-2">
                {nodes[st.node].options.map((o, i) => (
                  <button key={`${st.moves}-${i}`} onClick={() => pick(o)} className="chat-reply choice w-full text-left">
                    <TermText text={render(o.text, scope)} interactiveParent />
                  </button>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className="animate-rise space-y-3 pt-4">
              <div className="flex justify-center"><span className="chat-chip">{result.o.saving > 0 ? 'Сделка закрыта' : st.end === 'deal' ? 'Сделка закрыта дорого' : 'Разговор окончен'}</span></div>
              <Advisor tone={result.o.saving > 0 ? 'gain' : 'loss'}>
                {result.o.verdict}
                {result.gain.xp || result.gain.reputation ? <RewardPills xp={result.gain.xp} reputation={result.gain.reputation} /> : null}
              </Advisor>
              <div className="surface rounded-2xl border border-line p-4">
                <Label>Что это даст Дому за {n.orders} ролика</Label>
                <div className="mt-2 divide-y divide-line text-[14px]">
                  {result.o.orders.map((o) => (
                    <div key={o.n} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-muted">Ролик {o.n}: {o.note}</span>
                      <span className={`shrink-0 tabular-nums ${o.unit < result.o.start ? 'text-gain' : o.unit > result.o.start ? 'text-loss' : ''}`}>{fmtTg(o.unit)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between border-t border-line pt-2 text-[15px]">
                  <span>Итог против {fmtTg(result.o.start)} за ролик</span>
                  <b className={result.o.saving >= 0 ? 'text-gain' : 'text-loss'}>{result.o.saving >= 0 ? '+' : ''}{fmtTg(result.o.saving)}</b>
                </div>
                <p className="mt-2 text-[13px] text-muted">Можно было выжать до {fmtTg(result.o.bestSaving)}, сохранив партнёра.</p>
              </div>
              {saveErr && <p className="text-center text-[13px] text-loss">Награду записать не удалось: на телефоне не хватает места. Освободи память и пройди переговоры ещё раз.</p>}
              <p className="text-center text-[13px] text-muted">
                {result.gain.xp ? `+${result.gain.influence} Влияния · ` : !result.o.xp ? 'XP — только за сделку, после которой партнёр остаётся · ' : 'Награда за эти переговоры уже в казне · '}{result.gain.reputation === 0 && result.o.reputation > 0 ? 'Репутация за такой результат уже учтена' : result.gain.reputation === 0 ? 'Репутация без изменений' : 'Репутация учтена'}
              </p>
              <Button variant="ghost" full onClick={begin}>Переговоры заново</Button>
              <Button variant="quiet" full onClick={async () => { try { await navigator.clipboard.writeText(claudePrompt); setCopied(true) } catch { setCopied(false) } }}>
                {copied ? 'Промпт скопирован — вставь в чат с Claude' : 'Свободная тренировка с Claude: скопировать промпт'}
              </Button>
              <Button full onClick={() => nav('/')}>В Дом</Button>
            </div>
          )}
          <div ref={bottom} />
        </div>
      )}
    </div>
  )
}
