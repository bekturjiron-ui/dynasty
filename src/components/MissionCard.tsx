import { useEffect, useState } from 'react'
import { content } from '../content'
import type { Mission } from '../content/schema'
import type { MissionResult } from '../db'
import { completeMission } from '../game/engine'
import { fmtNum, parseUserNumber } from '../lib/format'
import { Button, Icon, Label } from './ui'

/** Своя миссия наставника: проверка числом, галочкой или фото. */
export function MissionCard({ mission: m, result }: { mission: Mission; result?: MissionResult }) {
  const [open, setOpen] = useState(false)
  const [num, setNum] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState<string>()
  const blob = result?.photo ?? photo ?? undefined
  useEffect(() => {
    if (!blob) { setUrl(undefined); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  const can = m.check === 'checkbox' || (m.check === 'number' && parseUserNumber(num) !== null) || (m.check === 'photo' && !!photo)
  async function submit() {
    setBusy(true)
    await completeMission(content, m, { value: m.check === 'number' ? parseUserNumber(num) ?? undefined : undefined, photo: m.check === 'photo' ? photo ?? undefined : undefined })
    setBusy(false); setOpen(false)
  }

  return (
    <div className={`rounded-2xl border p-4 ${result ? 'surface border-gain/40' : 'surface border-line'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label>Миссия от наставника</Label>
          <div className="mt-1 text-[16px] leading-snug">{m.title}</div>
          {m.description && <p className="mt-1 text-[14px] leading-relaxed text-muted">{m.description}</p>}
        </div>
        {result ? <span className="animate-check text-gain"><Icon name="check" /></span> : <span className="shrink-0 rounded-full bg-gold/15 px-2 py-1 text-[12px] font-semibold text-gold">+{m.reward.xp} XP</span>}
      </div>
      {result && (
        <div className="mt-3 flex items-center gap-3 text-[14px] text-gain">
          {url && <img src={url} alt="Пруф миссии" className="h-14 w-14 rounded-lg object-cover" />}
          <span>Выполнено {new Date(result.at).toLocaleDateString('ru-RU')}{result.value !== undefined ? ` · ${fmtNum(result.value)}` : ''}</span>
        </div>
      )}
      {!result && !open && <Button variant="ghost" full className="mt-3" onClick={() => setOpen(true)}>Отчитаться</Button>}
      {!result && open && (
        <div className="mt-3 space-y-3">
          {m.check === 'photo' && (
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gold/50 text-[14px] text-gold">
              {url ? <img src={url} alt="Пруф" className="max-h-48 rounded-lg" /> : <><Icon name="photo" size={28} />Фото или скриншот</>}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </label>
          )}
          {m.check === 'number' && (
            <input inputMode="decimal" value={num} onChange={(e) => setNum(e.target.value)} placeholder={m.numberLabel ?? 'Итоговая цифра'} className="min-h-12 w-full rounded-xl border border-line bg-ink px-4 text-[17px] outline-none focus:border-gold" />
          )}
          {m.check === 'checkbox' && <p className="text-[14px] text-muted">Подтверди, что сделал. Наставник может спросить подробности.</p>}
          <div className="flex gap-2">
            <Button variant="quiet" onClick={() => setOpen(false)}>Отмена</Button>
            <Button full disabled={!can || busy} onClick={submit}>Подтвердить</Button>
          </div>
        </div>
      )}
    </div>
  )
}
