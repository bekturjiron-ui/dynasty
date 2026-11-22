import { useEffect, useState } from 'react'
import { content } from '../content'
import type { Week } from '../content/schema'
import type { ContractResult } from '../db'
import { CONTRACT_REWARD, completeContract } from '../game/engine'
import { parseUserNumber, fmtNum } from '../lib/format'
import { Button, Icon, Label } from './ui'

/** Реальный контракт недели: действие в живом кабинете Kaspi с пруфом. */
export function ContractCard({ week, result }: { week: Week; result?: ContractResult }) {
  const [open, setOpen] = useState(false)
  const [num, setNum] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const preview = useObjectUrl(result?.photo ?? photo ?? undefined)
  const { proof } = week.contract

  async function submit() {
    setBusy(true)
    setErr('')
    const value = proof === 'number' ? parseUserNumber(num) ?? undefined : undefined
    try {
      await completeContract(content, week.key ?? week.n, proof, { value, photo: proof === 'photo' ? photo ?? undefined : undefined })
      setOpen(false)
    } catch {
      setErr('Не получилось сохранить. Возможно, на телефоне не хватает места: попробуй фото поменьше или освободи память.')
    } finally {
      setBusy(false)
    }
  }
  const canSubmit = proof === 'checkbox' || (proof === 'number' && parseUserNumber(num) !== null) || (proof === 'photo' && !!photo)

  return (
    <div className={`rounded-2xl border p-4 ${result ? 'surface border-gain/40' : 'surface-contract'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label tone="contract">Реальный контракт · неделя {week.n}</Label>
          <p className="mt-1 text-[15px] leading-relaxed">{week.contract.text}</p>
        </div>
        {result ? <span className="animate-check text-gain"><Icon name="check" /></span> : <span className="shrink-0 rounded-full bg-emerald/15 px-2.5 py-1 text-[12px] font-semibold text-emerald">+{CONTRACT_REWARD.xp} XP</span>}
      </div>

      {result && (
        <div className="mt-3 flex items-center gap-3 text-[14px] text-gain">
          {preview && <img src={preview} alt="Пруф контракта" className="h-14 w-14 rounded-lg object-cover" />}
          <span>Сдан {new Date(result.at).toLocaleDateString('ru-RU')}{result.value !== undefined ? ` · ${fmtNum(result.value)}` : ''}</span>
        </div>
      )}

      {!result && !open && <Button variant="ghost" full className="mt-3" onClick={() => setOpen(true)}>Сдать контракт</Button>}

      {!result && open && (
        <div className="mt-3 space-y-3">
          {proof === 'photo' && (
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gold/50 text-[14px] text-gold">
              {preview ? <img src={preview} alt="Пруф" className="max-h-48 rounded-lg" /> : <><Icon name="photo" size={28} />Фото или скриншот</>}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </label>
          )}
          {proof === 'number' && (
            <input inputMode="decimal" value={num} onChange={(e) => setNum(e.target.value)} placeholder={week.contract.numberLabel ?? 'Итоговая цифра'}
              className="min-h-12 w-full rounded-xl border border-line bg-ink px-4 text-[17px] outline-none focus:border-gold" />
          )}
          {proof === 'checkbox' && <p className="text-[14px] text-muted">Подтверди, что действие сделано в живом кабинете.</p>}
          <p className="text-[12px] text-muted">Пруф хранится только на этом телефоне.</p>
          {err && <p className="text-[13px] text-loss">{err}</p>}
          <div className="flex gap-2">
            <Button variant="quiet" onClick={() => setOpen(false)}>Отмена</Button>
            <Button full disabled={!canSubmit || busy} onClick={submit}>Подтвердить</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) { setUrl(undefined); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
