import { Button } from './ui'

/** Окно подтверждения опасного действия: красная кнопка «Подтвердить …» и «Отмена». Лежит выше нижней панели. */
export function ConfirmDialog({ title, text, confirmLabel, busyLabel, busy, onConfirm, onCancel }: {
  title: string
  text: string
  confirmLabel: string
  busyLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 md:items-center md:justify-center" onClick={() => !busy && onCancel()} role="dialog" aria-label={title}>
      <div className="pb-safe animate-rise surface w-full rounded-t-3xl border-t border-loss/50 px-5 pt-6 md:max-w-sm md:rounded-3xl md:border md:pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="text-[20px] font-semibold text-loss">{title}</div>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{text}</p>
        <div className="mt-5 space-y-2">
          <button disabled={busy} onClick={onConfirm} className="min-h-12 w-full rounded-xl bg-[#c0392b] text-[16px] font-semibold text-white shadow-[0_6px_18px_-6px_rgba(192,57,43,0.7)] active:scale-[0.98] active:brightness-90 disabled:opacity-50">
            {busy ? busyLabel ?? 'Подождите…' : confirmLabel}
          </button>
          <Button variant="quiet" full disabled={busy} onClick={onCancel}>Отмена</Button>
        </div>
      </div>
    </div>
  )
}
