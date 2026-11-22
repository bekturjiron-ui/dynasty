import { useEffect, useState } from 'react'
import { content } from '../content'
import { clearRankUp, onRankUp, peekRankUp, type RankUp } from '../game/events'
import { Button } from './ui'

const BASE = import.meta.env.BASE_URL
const stageImg = (n: number) => `${BASE}art/stage-${Math.max(1, Math.min(7, n))}-p.webp`

/** Падающие золотые искры: позиции и задержки считаются от номера, чтобы кадр был одинаков при каждом показе. */
const EMBERS = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: 1.2 + ((i * 53) % 30) / 10,
  dur: 2.6 + ((i * 29) % 18) / 10,
  size: 3 + (i % 4),
}))

/** Церемония нового титула: старый мир вспыхивает и уступает место новому, поверх падает корона и проявляется название. */
export function RankCeremony() {
  const [e, setE] = useState<RankUp | null>(() => peekRankUp())
  const [ready, setReady] = useState(false)
  useEffect(() => { const u = peekRankUp(); if (u) setE(u); return onRankUp(setE) }, [])

  // кнопка появляется после основной сцены; лёгкая вибрация на ударе вспышки
  useEffect(() => {
    if (!e) { setReady(false); return }
    const t1 = setTimeout(() => navigator.vibrate?.([40, 50, 40, 120]), 450)
    const t2 = setTimeout(() => setReady(true), 3600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [e])

  if (!e) return null
  const unlocked = content.empire.buildings.filter((b) => b.minRank === e.rank && b.cost > 0)
  // слова не рвём посреди: каждое слово — неразрывный блок, внутри буквы появляются по очереди
  let idx = 0
  const words = e.title.split(' ').map((w) => [...w].map((ch) => ({ ch, i: idx++ })))

  return (
    <div className="cer fixed inset-0 z-50 overflow-hidden bg-ink" role="dialog" aria-label="Новый титул">
      {/* старый мир → новый мир */}
      <img src={stageImg(e.rank - 1)} alt="" className="cer-old absolute inset-0 h-full w-full object-cover" onError={(ev) => (ev.currentTarget.style.display = 'none')} />
      <img src={stageImg(e.rank)} alt="" className="cer-new absolute inset-0 h-full w-full object-cover" onError={(ev) => (ev.currentTarget.style.display = 'none')} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(90% 60% at 50% 42%, rgba(17,17,20,0.15) 0%, rgba(17,17,20,0.78) 100%)' }} />

      {/* лучи света, вспышка и волна */}
      <div className="cer-rays pointer-events-none absolute left-1/2 top-[38%]" />
      <div className="cer-flash pointer-events-none absolute inset-0" />
      <div className="cer-ring pointer-events-none absolute left-1/2 top-[38%]" />

      {EMBERS.map((m, i) => (
        <i key={i} className="cer-ember pointer-events-none absolute top-0" style={{ left: `${m.left}%`, width: m.size, height: m.size, animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s` }} />
      ))}

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-8 text-center">
        <div className="cer-crown text-gold-soft drop-shadow-[0_0_24px_rgba(232,205,114,0.8)]">
          <svg width="116" height="88" viewBox="0 0 120 90" aria-hidden><path d="M10 70 22 20l24 30 14-40 14 40 24-30 12 50z" fill="currentColor" /><rect x="10" y="74" width="100" height="10" fill="currentColor" /></svg>
        </div>
        <div className="cer-label mt-5 text-[12px] font-semibold uppercase tracking-[0.3em] text-gold-soft">Новый титул</div>
        <h2 className="mt-3 font-serif text-[40px] leading-[1.05]" aria-label={e.title}>
          {words.map((w, wi) => (
            <span key={wi} className="inline-block whitespace-nowrap">
              {w.map(({ ch, i }) => (
                <span key={i} className="cer-letter gold-text inline-block" style={{ animationDelay: `${1.7 + i * 0.045}s` }} aria-hidden>{ch}</span>
              ))}
              {wi < words.length - 1 && ' '}
            </span>
          ))}
        </h2>
        <p className="cer-text mt-4 text-[16px] leading-relaxed text-parch/90" style={{ animationDelay: '2.9s' }}>Титул получен за реальный результат. Его не отнять.</p>
        {unlocked.length > 0 && (
          <div className="cer-text mt-4 flex flex-wrap justify-center gap-2" style={{ animationDelay: '3.1s' }}>
            <span className="w-full text-[11px] uppercase tracking-[0.2em] text-muted">Теперь доступно</span>
            {unlocked.map((b) => <span key={b.id} className="rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-[13px] text-gold-soft">{b.title}</span>)}
          </div>
        )}
        <Button className={`mt-9 w-full max-w-xs transition-opacity duration-500 ${ready ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => { clearRankUp(); setE(null) }}>Принять титул</Button>
      </div>
    </div>
  )
}
