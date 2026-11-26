import { useState } from 'react'

const BASE = import.meta.env.BASE_URL

/**
 * Фон урока и босса: «логово» босса недели. Картинка — public/art/lessons/w<key>.webp (вертикаль 1:2,
 * сцена в верхней половине, низ тёмный), имя по Week.key. Пока картинки нет, фон не рисуется.
 * Телефон: картинка во весь экран. От 768px: полоса до 60rem по центру (видна верхняя сцена), по бокам — размытая копия.
 */
export function LessonBackdrop({ weekKey }: { weekKey?: number }) {
  const [loaded, setLoaded] = useState<number | null>(null)
  if (!weekKey) return null
  const src = `${BASE}art/lessons/w${weekKey}.webp`
  const shown = loaded === weekKey
  return (
    <div className="lesson-bg pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden style={{ opacity: shown ? 1 : 0 }}>
      <img src={src} alt="" className="lesson-bg-blur absolute inset-0 hidden h-full w-full object-cover md:block" />
      <img
        key={weekKey}
        src={src}
        alt=""
        onLoad={() => setLoaded(weekKey)}
        onError={() => setLoaded(null)}
        className="lesson-bg-img relative h-full w-full object-cover md:mx-auto md:w-[min(100%,60rem)]"
      />
      <div className="lesson-bg-shade absolute inset-0" />
    </div>
  )
}
