import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { blobToDataUrl, downloadBlob } from '../game/backup'
import { buildCase, economyRows, renderCaseHtml, resultRows, type CaseStep } from '../game/caseFile'
import type { Game } from '../game/useGame'
import { dayKey } from '../lib/dates'
import { fmtNum } from '../lib/format'
import { Button, Card, Icon, Label, Title } from '../components/ui'

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-line/60 text-[14px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Thumb({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url ? <img src={url} alt="Пруф шага" className="mt-2 max-h-56 rounded-lg border border-line object-contain" /> : null
}

function StepCard({ step, blob, onNote }: { step: CaseStep; blob?: Blob; onNote: (key: number, text: string) => void }) {
  const [note, setNote] = useState(step.note)
  return (
    <Card className="space-y-1">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[13px] ${step.done ? 'border-gain bg-gain/10 text-gain' : 'border-line text-muted'}`}>
          {step.done ? <Icon name="check" size={15} /> : step.n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[18px] leading-snug">{step.title}</div>
          {step.deliverable && <p className="text-[12px] leading-relaxed text-muted">{step.deliverable}</p>}
        </div>
      </div>
      {step.done ? (
        <>
          {blob && <Thumb blob={blob} />}
          {step.value !== undefined && <p className="mt-2 text-[14px]">{step.numberLabel ?? 'Цифра'}: <b className="tabular-nums">{fmtNum(step.value)}</b></p>}
          <label className="mt-2 block">
            <span className="text-[12px] text-muted">Что сделал и какой вывод (попадёт в кейс)</span>
            <textarea
              value={note}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => { if (note !== step.note) onNote(step.key, note) }}
              placeholder="Например: сравнил три объявления, у всех оффер про бесплатный подбор. Беру этот угол."
              className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-[15px] leading-relaxed outline-none focus:border-gold"
            />
          </label>
        </>
      ) : (
        <p className="pl-10 text-[13px] text-muted">Шаг ещё не сдан: когда сдашь контракт недели {step.n}, он появится здесь.</p>
      )}
    </Card>
  )
}

/** Кейс проекта: пруфы, цифры и заметки 12 шагов одной страницей, с экспортом в HTML (для печати и PDF). */
export default function Case({ game }: { game: Game }) {
  const nav = useNavigate()
  const [training, setTraining] = useState(true)
  const [busy, setBusy] = useState(false)
  const notes = game.settings.caseNotes
  const model = useMemo(() => buildCase(game.content.weeks, game.st.contracts, game.settings.project, game.reports, notes), [game.content, game.st.contracts, game.settings.project, game.reports, notes])
  const economy = economyRows(model)
  const results = resultRows(model)

  async function saveNote(key: number, text: string) {
    await db.settings.put({ ...game.settings, caseNotes: { ...game.settings.caseNotes, [key]: text } })
  }

  async function exportHtml() {
    setBusy(true)
    try {
      const photos = new Map<number, string>()
      for (const s of model.steps) {
        const photo = game.st.contracts.get(s.key)?.photo
        if (photo) photos.set(s.key, await blobToDataUrl(photo))
      }
      const html = renderCaseHtml(model, photos, { training, houseName: game.player?.houseName ?? '' })
      downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `dynasty-case-${dayKey()}.html`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stagger space-y-4">
      <div className="pt-2">
        <button onClick={() => nav('/plan')} className="text-[14px] text-gold underline-offset-4 active:underline">‹ К плану</button>
        <Title className="mt-1">Кейс проекта</Title>
        <p className="mt-1 text-[14px] text-muted">
          «{model.project.name}»{model.project.niche ? ` · ${model.project.niche}` : ''}. Шагов сдано {model.doneCount} из {model.steps.length}. Всё, что ты сдаёшь в контрактах, собирается здесь.
        </p>
      </div>

      <Card tone="gold" className="space-y-3">
        <Label tone="gold">Готовый кейс</Label>
        <label className="flex items-center gap-3 text-[15px]">
          <input type="checkbox" checked={training} onChange={(e) => setTraining(e.target.checked)} className="h-5 w-5 accent-[#C9A227]" />
          Это учебный проект (пометка в кейсе)
        </label>
        <Button full onClick={exportHtml} disabled={busy || model.doneCount === 0}>{busy ? 'Собираю…' : 'Скачать кейс (HTML)'}</Button>
        <p className="text-[12px] leading-relaxed text-muted">
          Файл открывается в любом браузере. Чтобы получить PDF, открой его и выбери «Печать» → «Сохранить как PDF». Перед отправкой клиенту убери из скриншотов имена и телефоны покупателей.
        </p>
      </Card>

      <Card className="space-y-2">
        <Label>Экономика проекта</Label>
        <Rows rows={economy} />
        <p className="text-[12px] text-muted">Цифры берутся из брифа в Совете Дома.</p>
      </Card>

      <Card className="space-y-2">
        <Label>Результаты кампании</Label>
        {results.length ? <Rows rows={results} /> : <p className="text-[14px] text-muted">Недельных отчётов пока нет. Внеси цифры кампании или учебные цифры в Совете Дома, и они появятся здесь.</p>}
        {!results.length && <Button variant="ghost" full onClick={() => nav('/council')}>В Совет Дома</Button>}
      </Card>

      {model.steps.map((s) => <StepCard key={s.key} step={s} blob={game.st.contracts.get(s.key)?.photo} onNote={saveNote} />)}
    </div>
  )
}
