import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { content } from '../content'
import { PACK_DEFAULT_PCT, unitProfit } from '../content/scope'
import { db } from '../db'
import { downloadBlob, exportState, importState } from '../game/backup'
import type { Game } from '../game/useGame'
import { fmtTg, parseUserNumber } from '../lib/format'
import { Button, Card, Label, Title } from '../components/ui'
import { WeekReport } from './council/WeekReport'
import { KaspiImport } from './council/KaspiImport'

export default function Council({ game }: { game: Game }) {
  const nav = useNavigate()
  const s = game.settings
  const [fee, setFee] = useState(String(s.kaspiFeePct))
  const [delivery, setDelivery] = useState(String(s.deliveryCost))
  const [tax, setTax] = useState(String(s.taxPct))
  const [pack, setPack] = useState(String(s.packPct ?? PACK_DEFAULT_PCT))
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState('')

  const parsed = { kaspiFeePct: parseUserNumber(fee), deliveryCost: parseUserNumber(delivery), taxPct: parseUserNumber(tax), packPct: parseUserNumber(pack) }
  const valid =
    parsed.kaspiFeePct !== null && parsed.deliveryCost !== null && parsed.taxPct !== null && parsed.packPct !== null &&
    parsed.kaspiFeePct + parsed.taxPct + parsed.packPct < 100

  async function save() {
    if (!valid) return
    await db.settings.put({ ...s, kaspiFeePct: parsed.kaspiFeePct!, deliveryCost: parsed.deliveryCost!, taxPct: parsed.taxPct!, packPct: parsed.packPct! })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }
  async function onImport(f?: File) {
    if (!f) return
    if (!confirm('Заменить весь прогресс на данные из файла? Текущий прогресс на этом телефоне пропадёт.')) return
    try { await importState(f); setMsg('Бэкап восстановлен.') } catch (e) { setMsg(`Не получилось: ${(e as Error).message}`) }
  }

  const field = (label: string, v: string, set: (x: string) => void, suffix: string) => (
    <label className="block">
      <span className="text-[13px] text-muted">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} className="min-h-12 w-full rounded-xl border border-line bg-ink px-4 outline-none focus:border-gold" />
        <span className="w-6 text-muted">{suffix}</span>
      </div>
    </label>
  )

  return (
    <div className="stagger space-y-5">
      <div className="pt-2">
        <Title>Совет Дома</Title>
        <p className="mt-1 text-[14px] text-muted">Раз в неделю Дом сверяет цифры: что продано, сколько заработано, куда ушла реклама.</p>
      </div>

      <WeekReport game={game} />
      <KaspiImport game={game} />

      <div className="pt-2"><Label>Настройки Дома</Label></div>

      <Card className="space-y-3">
        <Label>Ставки Kaspi, налог, упаковка</Label>
        <p className="text-[13px] text-muted">Комиссии и тарифы меняются — бери актуальные из кабинета продавца. Уроки пересчитываются по этим цифрам.</p>
        {field('Комиссия Kaspi', fee, setFee, '%')}
        {field('Доставка до покупателя — если у товара тариф не указан', delivery, setDelivery, '₸')}
        {field('Налог (упрощёнка, с выручки)', tax, setTax, '%')}
        {field('Упаковка, от цены', pack, setPack, '%')}
        <Button full disabled={!valid} onClick={save}>{saved ? 'Сохранено' : 'Сохранить'}</Button>
      </Card>

      <Card>
        <Label>Товары в уроках{content.productsAreDemo ? ' · демо' : ''}</Label>
        <div className="mt-2 divide-y divide-line text-[14px]">
          {content.products.map((p) => {
            const pr = unitProfit(p, s)
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex-1 leading-snug">{p.name}<span className="block text-[12px] text-muted">цена {fmtTg(p.price)} · закуп {fmtTg(p.cost)} · доставка {fmtTg(p.delivery ?? s.deliveryCost)}</span></span>
                <span className={`tabular-nums ${pr < 0 ? 'text-loss' : 'text-gain'}`}>{fmtTg(pr)}</span>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[12px] text-muted">Справа — прибыль с одной продажи при текущих ставках.</p>
      </Card>

      <Card className="space-y-3">
        <Label>Бэкап</Label>
        <p className="text-[13px] text-muted">Весь прогресс живёт только на этом телефоне. Раз в неделю сохраняй файл — в «Файлы» или себе в Telegram.</p>
        <Button variant="ghost" full onClick={async () => downloadBlob(await exportState())}>Сохранить бэкап</Button>
        <label className="block">
          <span className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl text-[15px] text-muted active:bg-panel2">Восстановить из файла</span>
          <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
        </label>
        {msg && <p className="text-[13px] text-gold">{msg}</p>}
      </Card>

      <button onClick={() => nav('/admin')} className="w-full py-2 text-center text-[13px] text-muted underline-offset-4 active:underline">Админ-панель</button>

      <Card className="space-y-2 text-[14px] leading-relaxed text-muted">
        <Label>Напоминание</Label>
        <p>Push-уведомлений в этой версии нет. Поставь в «Напоминаниях» iPhone ежедневное напоминание со ссылкой на игру — например, на 20:00.</p>
      </Card>
    </div>
  )
}
