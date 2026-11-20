import { useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { content } from '../../content'
import { db } from '../../db'
import {
  FIELDS, PII, applyFilter, byProduct, byWeek, defaultFilter, findHeader, guessMapping, matchProduct, normalize, period,
  type Filter, type Mapping, type Row,
} from '../../game/importKaspi'
import type { Game } from '../../game/useGame'
import { fmtNum, fmtPct, fmtTg } from '../../lib/format'
import { Advisor, Button, Card, Label } from '../../components/ui'

type Parsed = { fileName: string; raw: unknown[][]; header: number; headers: string[] }
type Step = 'idle' | 'columns' | 'filter'

const tip = { contentStyle: { background: '#1f1f23', border: '1px solid #2c2c31', borderRadius: 12, color: '#ede7d9', fontSize: 13 }, labelStyle: { color: '#9a9486' } }
const axis = { tick: { fill: '#9a9486', fontSize: 11 }, axisLine: false, tickLine: false } as const

export function KaspiImport({ game }: { game: Game }) {
  const [step, setStep] = useState<Step>('idle')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [map, setMap] = useState<Mapping>({})
  const [rows, setRows] = useState<Row[]>([])
  const [skipped, setSkipped] = useState(0)
  const [filter, setFilter] = useState<Filter>({ statuses: [], excludeCategories: [] })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function onFile(f?: File) {
    if (!f) return
    setErr(''); setBusy(true)
    try {
      const XLSX = await import('xlsx') // тяжёлая библиотека — грузим только сейчас
      const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true })
      const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: true })
      const header = findHeader(raw)
      const headers = ((raw[header] ?? []) as unknown[]).map((h) => String(h ?? '').trim())
      if (headers.length < 3) throw new Error('Не нашёл строку заголовков. Это точно выгрузка заказов?')
      setParsed({ fileName: f.name, raw, header, headers })
      setMap(guessMapping(headers))
      setStep('columns')
    } catch (e) {
      setErr(`Файл не прочитался: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  function toFilter() {
    if (!parsed) return
    const r = normalize(parsed.raw, parsed.header, map)
    if (!r.rows.length) { setErr('После сопоставления не осталось ни одного заказа: проверь колонки «Товар» и «Дата».'); return }
    setRows(r.rows); setSkipped(r.skipped)
    const f = defaultFilter(r.rows)
    // чехлы и прочая не-косметика по умолчанию выключены, если в архиве есть категория косметики
    const cats = [...new Set(r.rows.map((x) => x.category))]
    f.excludeCategories = cats.filter((c) => /чехл|смартфон|телефон|аксессуар/i.test(c))
    setFilter(f); setErr(''); setStep('filter')
  }

  async function save() {
    // В базу уходят только нормализованные строки: товар, дата, сумма, количество, статус, доставка, категория
    await db.imports.put({ id: 'kaspi', at: new Date().toISOString(), fileName: parsed!.fileName, rows, filter, apply: game.kaspi?.apply ?? { price: false, orders: true, delivery: false } })
    setParsed(null); setRows([]); setStep('idle')
  }

  // ---------- Мастер ----------
  if (step === 'columns' && parsed) {
    const sample = (i: number) => { const v = parsed.raw[parsed.header + 1]?.[i]; return v instanceof Date ? v.toLocaleDateString('ru-RU') : String(v ?? '').slice(0, 40) }
    const options = parsed.headers.map((h, i) => ({ h, i })).filter((o) => o.h && !PII.test(o.h))
    const missing = FIELDS.filter((f) => f.required && map[f.key] === undefined)
    return (
      <Card className="space-y-3">
        <Label>Импорт · шаг 1 из 2 · колонки</Label>
        <p className="text-[13px] text-muted">{parsed.fileName}. Колонки с покупателями (имя, телефон, адрес, отзывы) в список не попадают и не сохраняются.</p>
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-[13px] text-muted">{f.label}{f.required ? ' *' : ''}</span>
            <select value={map[f.key] ?? ''} onChange={(e) => setMap({ ...map, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-ink px-3 text-[15px] text-parch">
              <option value="">— не брать —</option>
              {options.map((o) => <option key={o.i} value={o.i}>{o.h}</option>)}
            </select>
            {map[f.key] !== undefined && <span className="mt-1 block truncate text-[12px] text-gold-soft">например: {sample(map[f.key]!)}</span>}
          </label>
        ))}
        {err && <p className="text-[13px] text-loss">{err}</p>}
        <div className="flex gap-2">
          <Button variant="quiet" onClick={() => { setStep('idle'); setParsed(null) }}>Отмена</Button>
          <Button full disabled={missing.length > 0} onClick={toFilter}>{missing.length ? `Нужно: ${missing.map((m) => m.label).join(', ')}` : 'Дальше'}</Button>
        </div>
      </Card>
    )
  }

  if (step === 'filter') {
    const statuses = [...new Set(rows.map((r) => r.status))].filter(Boolean)
    const cats = [...new Set(rows.map((r) => r.category))].filter(Boolean)
    const count = (pred: (r: Row) => boolean) => rows.filter(pred).length
    const kept = applyFilter(rows, filter)
    const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
    return (
      <Card className="space-y-3">
        <Label>Импорт · шаг 2 из 2 · что считать</Label>
        {statuses.length > 0 && (
          <div>
            <div className="text-[13px] text-muted">Статусы в зачёт (отменённые денег не приносят)</div>
            {statuses.map((s) => (
              <label key={s} className="mt-1 flex items-center gap-3 py-1 text-[15px]">
                <input type="checkbox" checked={filter.statuses.includes(s)} onChange={() => setFilter({ ...filter, statuses: toggle(filter.statuses, s) })} className="h-5 w-5 accent-[#c9a227]" />
                {s} <span className="text-muted">· {count((r) => r.status === s)}</span>
              </label>
            ))}
          </div>
        )}
        {cats.length > 1 && (
          <div>
            <div className="text-[13px] text-muted">Категории (сними галочку, чтобы не считать — например, чехлы)</div>
            {cats.map((c) => (
              <label key={c} className="mt-1 flex items-center gap-3 py-1 text-[15px]">
                <input type="checkbox" checked={!filter.excludeCategories.includes(c)} onChange={() => setFilter({ ...filter, excludeCategories: toggle(filter.excludeCategories, c) })} className="h-5 w-5 accent-[#c9a227]" />
                <span className="flex-1">{c}</span><span className="text-muted">{count((r) => r.category === c)}</span>
              </label>
            ))}
          </div>
        )}
        <Advisor>В зачёт пойдёт {kept.length} из {rows.length} заказов{skipped ? `, ${skipped} строк без товара или даты пропущено` : ''}. Сохранятся только товар, дата, сумма, количество, статус, доставка и категория.</Advisor>
        <div className="flex gap-2">
          <Button variant="quiet" onClick={() => setStep('columns')}>Назад</Button>
          <Button full disabled={!kept.length} onClick={save}>Сохранить импорт</Button>
        </div>
      </Card>
    )
  }

  // ---------- Сводка по сохранённому архиву ----------
  return (
    <>
      <Card className="space-y-3">
        <Label>Архив заказов Kaspi</Label>
        {game.kaspi ? <Summary game={game} /> : <p className="text-[14px] leading-relaxed text-muted">Кабинет Kaspi → Заказы → Архив → выгрузка в Excel. Загрузи файл сюда: Совет посчитает продажи по товарам и неделям, а уроки возьмут настоящие цифры Novelia.</p>}
        <label className="block">
          <span className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-gold/50 text-[15px] font-semibold text-gold ${busy ? 'opacity-50' : ''}`}>
            {busy ? 'Читаю файл…' : game.kaspi ? 'Загрузить новый архив' : 'Загрузить архив .xlsx'}
          </span>
          <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {err && <p className="text-[13px] text-loss">{err}</p>}
      </Card>
    </>
  )
}

function Summary({ game }: { game: Game }) {
  const k = game.kaspi!
  const rows = game.kaspiRows
  const s = game.settings
  const per = period(rows)
  const revenue = rows.reduce((a, r) => a + r.amount, 0)
  const costOf = (n: string) => { const p = matchProduct(n, content.products); return p ? p.cost + p.inbound : undefined }
  const weeks = useMemo(() => byWeek(rows, costOf, { fee: s.kaspiFeePct / 100, tax: s.taxPct / 100, pack: (s.packPct ?? 1) / 100 }).map((w) => ({ ...w, marginPct: w.margin !== undefined ? Math.round(w.margin * 1000) / 10 : null })), [rows, s]) // eslint-disable-line react-hooks/exhaustive-deps
  const products = byProduct(rows).slice(0, 8)
  const setApply = (key: 'price' | 'orders' | 'delivery') => db.imports.update('kaspi', { apply: { ...k.apply, [key]: !k.apply[key] } })

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted">
        {k.fileName} · {per.from ? `${new Date(per.from).toLocaleDateString('ru-RU')} — ${new Date(per.to).toLocaleDateString('ru-RU')}` : ''} · в зачёте {rows.length} зак. на {fmtTg(revenue)}
      </p>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={weeks} margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#2c2c31" vertical={false} />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
            <YAxis yAxisId="r" {...axis} width={48} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}к`} />
            <YAxis yAxisId="m" orientation="right" {...axis} width={34} tickFormatter={(v) => `${v}%`} />
            <Tooltip {...tip} cursor={{ fill: '#ffffff08' }} formatter={(v, name) => (name === 'revenue' ? [fmtTg(Number(v)), 'Выручка'] : [`${fmtNum(Number(v))}%`, 'Маржа'])} />
            <Bar yAxisId="r" dataKey="revenue" fill="#c9a227" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            <Line yAxisId="m" dataKey="marginPct" stroke="#86b77e" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gold" />Выручка по неделям</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-gain" />Маржа (по товарам с известным закупом)</span>
      </div>

      <div>
        <Label>Товары по выручке</Label>
        <div className="mt-1 divide-y divide-line text-[13px]">
          {products.map((p) => {
            const m = matchProduct(p.name, content.products)
            return (
              <div key={p.name} className="flex items-center gap-3 py-2">
                <span className="flex-1 leading-snug">
                  {m?.short ?? p.name}
                  {!m && <span className="block text-[11px] text-muted">нет в уроках</span>}
                  {m && !p.name.toLowerCase().includes(m.name.toLowerCase()) && <span className="block truncate text-[11px] text-muted">другая карточка: {p.name}</span>}
                </span>
                <span className="w-16 text-right tabular-nums text-muted">{fmtNum(Math.round(p.perMonth * 10) / 10)}/мес</span>
                <span className="w-20 text-right tabular-nums">{fmtTg(p.revenue)}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Что подставлять в уроки</Label>
        <p className="text-[12px] text-muted">Уроки недели 2 и её босс берут цифры по {game.overrides.length} товарам из архива.</p>
        {([['orders', 'Продажи в месяц'], ['price', 'Средняя цена из архива (иначе — текущая из карточки)'], ['delivery', 'Средняя доставка из архива (иначе — текущий тариф)']] as const).map(([key, text]) => (
          <label key={key} className="flex items-center gap-3 py-1 text-[14px]">
            <input type="checkbox" checked={k.apply[key]} onChange={() => setApply(key)} className="h-5 w-5 accent-[#c9a227]" />{text}
          </label>
        ))}
        {game.overrides.length > 0 && (
          <p className="pt-1 text-[12px] leading-relaxed text-muted">
            {game.overrides.map((o) => `${content.products.find((p) => p.id === o.id)?.short}: ${fmtNum(o.orders)}/мес`).join(' · ')}
          </p>
        )}
      </div>
      <Advisor>
        Средняя маржа по архиву: <b className="text-gold">{(() => { const m = weeks.filter((w) => w.margin !== undefined); const r = m.reduce((a, w) => a + w.revenue, 0); return r ? fmtPct(m.reduce((a, w) => a + (w.margin ?? 0) * w.revenue, 0) / r) : '—' })()}</b> — столько Дом оставляет себе с каждого тенге выручки после комиссии, налога, упаковки, доставки и закупа.
      </Advisor>
      <Button variant="quiet" full onClick={() => { if (confirm('Удалить импорт архива? Уроки вернутся к цифрам из файла товаров.')) db.imports.delete('kaspi') }}>Удалить импорт</Button>
    </div>
  )
}
