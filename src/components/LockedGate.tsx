import { useNavigate } from 'react-router-dom'
import { Advisor, Button, Icon } from './ui'

/** Заглушка при входе по прямой ссылке на закрытый урок, босса или переговоры. */
export function LockedGate({ done, total, message }: { done?: number; total?: number; message?: string }) {
  const nav = useNavigate()
  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-4 pb-16">
      <span className="text-gold"><Icon name="lock" size={28} /></span>
      <Advisor>{message ?? `Сначала уроки недели: пройдено ${done} из ${total}. После них этот вызов откроется.`}</Advisor>
      <Button full onClick={() => nav('/plan')}>К плану</Button>
    </div>
  )
}
