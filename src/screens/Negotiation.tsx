import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { content } from '../content'
import type { NegOption } from '../content/schema'
import { completeNegotiation } from '../game/engine'
import { choose, COLD_LIMIT, negScope, outcome, startNeg, type NegOutcome, type NegState } from '../game/negotiation'
import { useGame } from '../game/useGame'
import { fmtTg } from '../lib/format'
import { render } from '../lib/template'
import { Advisor, Button, Icon, Label } from '../components/ui'

type Line = { who: 'npc' | 'me' | 'note'; text: string; loyalty?: number }

export default function NegotiationScreen() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const game = useGame()
  const n = content.negotiations[id]
  const [st, setSt] = useState<NegState | null>(null)
  const [log, setLog] = useState<Line[]>([])
  const [result, setResult] = useState<{ o: NegOutcome; gain: { xp: number; influence: number; reputation: number } } | null>(null)
  const [copied, setCopied] = useState(false)
  const [saveErr, setSaveErr] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  const base = game.loading ? null : game.scope
  const scope = useMemo(() => (n && base ? negScope(n, base, st ?? undefined) : null), [n, base, st])
  const nodes = useMemo(() => (n ? Object.fromEntries(n.nodes.map((x) => [x.id, x])) : {}), [n])

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [log.length, result])

  if (!n) return <div className="pt-safe px-4 text-muted">Этих переговоров нет в контенте.</div>
  if (!base || !scope) return null
  const product = scope.product as { short: string; price: number; delivery: number; cost: number; inbound: number }

  function begin() {
    const s = startNeg(n)
    setSt(s)
    setResult(null)
    setSaveErr(false)
    setLog([{ who: 'npc', text: render(nodes[s.node].npcLine, negScope(n, base!, s)) }])
  }

  async function pick(o: NegOption) {
    if (!st) return
    const next = choose(n, st, o)
    const sc = negScope(n, base!, next)
    const lines: Line[] = [{ who: 'me', text: render(o.text, negScope(n, base!, st)), loyalty: next.loyalty - st.loyalty }]
    if (!next.end) {
      if (next.cold === 1) lines.push({ who: 'note', text: `${n.supplier.name} отвечает суше. Если отношения не потеплеют, через 2 хода она закончит разговор.` })
      if (next.cold === COLD_LIMIT - 1) lines.push({ who: 'note', text: `Последний шанс: ещё один холодный ход — и ${n.supplier.name} уйдёт.` })
      if (st.cold > 0 && next.cold === 0) lines.push({ who: 'note', text: 'Лёд тронулся: отношения снова тёплые.' })
      lines.push({ who: 'npc', text: render(nodes[next.node].npcLine, sc) })
    } else if (next.end === 'left') {
      lines.push({ who: 'npc', text: 'Знаете, давайте на этом закончим. Удачи вам с другими поставщиками.' })
    } else if (next.end === 'walkout') {
      lines.push({ who: 'npc', text: 'Извините, у меня следующая встреча. Вернёмся к разговору как-нибудь потом.' })
    } else if (next.end === 'deal') {
      lines.push({ who: 'npc', text: next.loyalty >= n.coldBelow ? `Договорились! Отправляю счёт: ${fmtTg(sc.price as number)} за штуку.` : `Хорошо. ${fmtTg(sc.price as number)} за штуку. Счёт пришлю.` })
    }
    setLog((l) => [...l, ...lines])
    setSt(next)
    if (next.end) {
      const o2 = outcome(n, next, base!)
      let gain = { xp: 0, influence: 0, reputation: 0 }
      try {
        gain = await completeNegotiation(content, n.id, {
          end: next.end, discount: next.discount, loyalty: next.loyalty, saving: o2.saving, xp: o2.xp, influence: o2.influence, reputation: o2.reputation,
        })
        setSaveErr(false)
      } catch {
        setSaveErr(true) // итог всё равно показываем, чтобы разговор не пропал
      }
      setResult({ o: o2, gain })
    }
  }

  const unitProfitAt = (unit: number) => product.price * (1 - (scope.fee as number) - (scope.tax as number) - (scope.pack as number)) - product.delivery - unit - product.inbound

  const claudePrompt = `Сыграй роль ${n.supplier.name}, ${n.supplier.role} компании «${n.supplier.company}». Я — менеджер магазина Novelia на Kaspi. Обсуждаем закуп «${product.short}»: сейчас ${fmtTg(scope.start as number)} за штуку, партия ${n.volume} шт. У тебя есть скрытый минимум цены и терпение; на давление и грубость реагируй холоднее, на честные аргументы и выгоду для обеих сторон — теплее. После 8–10 реплик выйди из роли и разбери мои переговоры: где я давил, где влиял, что можно было выжать.`

  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-6">
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => nav(-1)} aria-label="Закрыть" className="flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-panel"><Icon name="close" /></button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/50 font-serif text-[18px] text-gold">{n.supplier.name[0]}</div>
        <div className="leading-tight">
          <div className="text-[15px]">{n.supplier.name}</div>
          <div className="text-[12px] text-muted">{n.supplier.role}, «{n.supplier.company}»</div>
        </div>
      </div>

      {/* Шкалы «Цена» и «Лояльность» */}
      {st && (
        <div className="sticky top-0 z-10 -mx-4 mb-3 space-y-2 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur">
          <div>
            <div className="flex justify-between text-[12px]"><span className="text-muted">Цена закупа</span><span className="tabular-nums text-parch">{fmtTg(scope.price as number)} <span className="text-gold">−{st.discount}%</span></span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${Math.min(1, st.discount / 15) * 100}%` }} /></div>
          </div>
          <div>
            <div className="flex justify-between text-[12px]"><span className="text-muted">Лояльность партнёра</span><span className={`tabular-nums ${st.loyalty < n.coldBelow ? 'text-loss' : st.loyalty >= 70 ? 'text-gain' : 'text-parch'}`}>{st.loyalty}</span></div>
            <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-line">
              <div className={`h-full rounded-full transition-[width] duration-500 ${st.loyalty < n.coldBelow ? 'bg-loss' : 'bg-gain'}`} style={{ width: `${st.loyalty}%` }} />
              <div className="absolute top-0 h-full w-px bg-parch/50" style={{ left: `${n.coldBelow}%` }} />
            </div>
          </div>
        </div>
      )}

      {!st && (
        <div className="animate-rise space-y-4">
          <Label>Переговоры · неделя {n.week}</Label>
          <h1 className="font-serif text-[26px] leading-tight">{n.title}</h1>
          <Advisor>{render(n.intro, scope)}</Advisor>
          <p className="text-[14px] leading-relaxed text-muted">
            Сколько поставщик может уступить, ты не знаешь. Видно цену и лояльность. Давление даёт скидку сейчас, но если партнёр остынет — через 2 хода он уйдёт, а замена стоит дороже. Итог считается на {n.orders} партии по {n.volume} шт.
          </p>
          <Button full onClick={begin}>Начать разговор</Button>
        </div>
      )}

      {st && (
        <div className="flex-1 space-y-3">
          {log.map((l, i) =>
            l.who === 'note' ? (
              <div key={i} className="animate-rise mx-auto max-w-[90%] rounded-xl border border-loss/40 bg-loss/5 px-3 py-2 text-center text-[13px] text-loss">{l.text}</div>
            ) : (
              <div key={i} className={`animate-rise flex flex-col ${l.who === 'me' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${l.who === 'me' ? 'rounded-br-md bg-gold/15 text-parch' : 'rounded-bl-md bg-panel2 text-parch'}`}>{l.text}</div>
                {l.who === 'me' && l.loyalty !== undefined && l.loyalty !== 0 && (
                  <span className={`mt-1 text-[11px] ${l.loyalty > 0 ? 'text-gain' : 'text-loss'}`}>лояльность {l.loyalty > 0 ? '+' : ''}{l.loyalty}</span>
                )}
              </div>
            ),
          )}

          {!st.end && (
            <div className="space-y-2 pt-2">
              {nodes[st.node].options.map((o, i) => (
                <button key={`${st.moves}-${i}`} onClick={() => pick(o)} className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-left text-[15px] leading-snug active:border-gold active:bg-panel2">
                  {render(o.text, scope)}
                </button>
              ))}
            </div>
          )}

          {result && (
            <div className="animate-rise space-y-3 pt-2">
              <Advisor tone={result.o.saving > 0 ? 'gain' : 'loss'}>{result.o.verdict}</Advisor>
              <div className="rounded-2xl border border-line bg-panel p-4">
                <Label>Что это даст Дому за {n.orders} партии по {n.volume} шт.</Label>
                <div className="mt-2 divide-y divide-line text-[14px]">
                  {result.o.orders.map((o) => (
                    <div key={o.n} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-muted">Партия {o.n}: {o.note}</span>
                      <span className={`shrink-0 tabular-nums ${o.unit < result.o.start ? 'text-gain' : o.unit > result.o.start ? 'text-loss' : ''}`}>{fmtTg(o.unit)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between border-t border-line pt-2 text-[15px]">
                  <span>Итог против {fmtTg(result.o.start)} за штуку</span>
                  <b className={result.o.saving >= 0 ? 'text-gain' : 'text-loss'}>{result.o.saving >= 0 ? '+' : ''}{fmtTg(result.o.saving)}</b>
                </div>
                <p className="mt-2 text-[13px] text-muted">Можно было выжать до {fmtTg(result.o.bestSaving)}, сохранив партнёра.</p>
                {result.o.dealUnit !== undefined && (
                  <p className="mt-2 text-[13px] leading-relaxed">
                    {product.short}: прибыль с продажи {fmtTg(unitProfitAt(result.o.start))} → <b className={unitProfitAt(result.o.dealUnit) >= 0 ? 'text-gain' : 'text-loss'}>{fmtTg(unitProfitAt(result.o.dealUnit))}</b>
                    {result.o.orders[1] && result.o.orders[1].unit > result.o.start ? ' — но только на первой партии.' : '.'}
                  </p>
                )}
              </div>
              {saveErr && <p className="text-center text-[13px] text-loss">Награду записать не удалось: на телефоне не хватает места. Освободи память и пройди переговоры ещё раз.</p>}
              <p className="text-center text-[13px] text-muted">
                {result.gain.xp ? `+${result.gain.xp} XP · +${result.gain.influence} Влияния · ` : !result.o.xp ? 'XP — только за сделку, после которой партнёр остаётся · ' : 'Награда за эти переговоры уже в казне · '}Репутация {result.gain.reputation >= 0 ? '+' : ''}{result.gain.reputation}
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
