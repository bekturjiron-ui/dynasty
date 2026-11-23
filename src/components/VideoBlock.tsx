import { useState } from 'react'
import type { Video } from '../content/schema'
import { Advisor, Button, Icon, Label } from './ui'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Вставка с YouTube по тапу: без сети и без согласия на загрузку плеер не грузится, урок идёт по тексту. */
export function VideoBlock({ video }: { video: Video }) {
  const [play, setPlay] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const online = typeof navigator === 'undefined' || navigator.onLine
  const watchUrl = `https://www.youtube.com/watch?v=${video.youtubeId}&t=${video.start}s`
  const src = `https://www.youtube-nocookie.com/embed/${video.youtubeId}?start=${video.start}&end=${video.end}&autoplay=1&playsinline=1&rel=0`
  const minutes = Math.max(1, Math.round((video.end - video.start) / 60))
  const q = video.question
  const chosen = q && picked !== null ? q.choice.options[picked] : null

  return (
    <div className="surface space-y-3 rounded-2xl border border-line p-3">
      <Label>Видео · {minutes} мин · с {clock(video.start)}</Label>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
        {play && online ? (
          <iframe className="absolute inset-0 h-full w-full" src={src} title={video.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
        ) : online ? (
          <button onClick={() => setPlay(true)} aria-label={`Смотреть: ${video.title}`} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gold-soft active:bg-white/5">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/60 bg-gold/10 pl-1 text-[22px]">▶</span>
            <span className="text-[13px] text-parch/80">Смотреть отрезок</span>
          </button>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[14px] text-muted">Видео откроется, когда появится интернет. Урок можно пройти и без него.</div>
        )}
      </div>
      <div className="text-[14px] leading-snug text-parch">{video.title}{video.channel ? <span className="text-muted"> · {video.channel}</span> : null}</div>
      <p className="text-[14px] leading-relaxed text-muted">На что смотреть: {video.focus}</p>
      <a href={watchUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1 text-[13px] text-gold underline-offset-4 active:underline">Открыть на YouTube</a>
      {q && (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-[15px] leading-relaxed">{q.prompt}</p>
          {q.choice.options.map((o, i) => (
            <button key={i} onClick={() => setPicked(i)} className={`choice w-full rounded-xl border px-3 py-3 text-left text-[14px] leading-snug ${picked === i ? (o.correct ? 'border-gain/60 bg-gain/5' : 'border-loss/60 bg-loss/5') : 'border-line'}`}>
              <span className="flex items-start gap-2">{picked === i && o.correct && <span className="text-gain"><Icon name="check" size={16} /></span>}{o.text}</span>
            </button>
          ))}
          {chosen && <Advisor tone={chosen.correct ? 'gain' : 'loss'}>{chosen.why}</Advisor>}
          {chosen && !chosen.correct && <Button variant="quiet" full onClick={() => setPicked(null)}>Выбрать ещё раз</Button>}
        </div>
      )}
    </div>
  )
}
