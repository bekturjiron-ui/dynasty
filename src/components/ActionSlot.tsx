import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Место под кнопки «вперёд» в нижней панели урока. Экран урока кладёт сюда DOM-узел панели,
 * а глубоко вложенные компоненты (ExerciseView) отправляют туда свои кнопки через <Actions>.
 * Без провайдера (например, у босса) кнопки остаются на своём месте в потоке.
 */
const SlotCtx = createContext<HTMLElement | null>(null)

export const ActionSlotProvider = SlotCtx.Provider

export function Actions({ children }: { children: ReactNode }) {
  const el = useContext(SlotCtx)
  return el ? createPortal(children, el) : <>{children}</>
}
