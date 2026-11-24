import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Week } from '../content/schema'
import type { ContractResult } from '../db'
import { Icon, Label } from './ui'

/** Сквозной проект: 12 шагов контрактов ведут один мини-проект от разведки до портфолио-кейса. */
export function ProjectCard({ weeks, contracts, onOpen }: { weeks: Week[]; contracts: Map<number, ContractResult>; onOpen: (key: number) => void }) {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const steps = weeks.filter((w) => w.contract.title)
  if (steps.length === 0) return null
  const done = steps.filter((w) => contracts.has(w.key ?? w.n)).length
  const next = steps.find((w) => !contracts.has(w.key ?? w.n))

  return (
    <div className="surface-contract rounded-2xl border p-4">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          <Label tone="contract">Проект Дома · {done} из {steps.length} шагов</Label>
          <p className="mt-1 text-[14px] leading-snug text-parch/90">
            {next ? <>Дальше: <span className="text-gold-soft">{next.contract.title}</span></> : 'Кейс собран. Покажи его будущему клиенту.'}
          </p>
        </div>
        <span className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4.5 7l4.5 4.5L13.5 7" /></svg></span>
      </button>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-emerald transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <button onClick={() => nav('/case')} className="mt-3 text-[14px] text-gold underline-offset-4 active:underline">Открыть кейс проекта ›</button>
      {open && (
        <ol className="mt-3 space-y-1">
          {steps.map((w) => {
            const ok = contracts.has(w.key ?? w.n)
            return (
              <li key={w.key ?? w.n}>
                <button onClick={() => onOpen(w.key ?? w.n)} className="flex w-full items-center gap-3 rounded-lg py-1.5 text-left active:bg-white/5">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[12px] ${ok ? 'border-gain bg-gain/10 text-gain' : 'border-line text-muted'}`}>
                    {ok ? <Icon name="check" size={14} /> : w.n}
                  </span>
                  <span className={`text-[14px] ${ok ? 'text-muted' : ''}`}>{w.contract.title}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
