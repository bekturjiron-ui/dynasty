import { useState } from 'react'

const BASE = import.meta.env.BASE_URL

/**
 * Фон урока и босса: «логово» босса недели. Картинки — public/art/lessons/w<key>-p.webp (телефон)
 * и w<key>-l.webp (от 768px), имя по Week.key. Пока картинки нет, фон не рисуется: экран остаётся как был.
 * Сильно затемнён, чтобы текст урока читался.
 */
export function LessonBackdrop({ weekKey }: { weekKey?: number }) {
  const [loaded, setLoaded] = useState<number | null>(null)
  if (!weekKey) return null
  const shown = loaded === weekKey
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden style={{ opacity: shown ? 1 : 0, transition: 'opacity 600ms ease' }}>
      <picture key={weekKey}>
        <source media="(min-width: 768px)" srcSet={`${BASE}art/lessons/w${weekKey}-l.webp`} />
        <img
          src={`${BASE}art/lessons/w${weekKey}-p.webp`}
          alt=""
          onLoad={() => setLoaded(weekKey)}
          onError={() => setLoaded(null)}
          className="h-full w-full object-cover"
          style={{ objectPosition: '50% 35%', filter: 'brightness(0.5) saturate(0.9)' }}
        />
      </picture>
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(14,14,16,0.55) 0%, rgba(14,14,16,0.35) 22%, rgba(14,14,16,0.7) 50%, rgba(14,14,16,0.92) 100%)' }}
      />
    </div>
  )
}
