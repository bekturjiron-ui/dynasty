// Совет Дома: метрики кампании и «доклад советника» по дереву диагностики. Чистые функции.
import type { ProjectBrief, WeeklyReport } from '../db'

export type CampaignNumbers = Omit<WeeklyReport, 'week' | 'note' | 'at'>

/** Число с запятой, как принято в русском тексте. */
const dec = (v: number, digits: number) => v.toFixed(digits).replace(".", ",")
const ratio = (a: number, b: number) => (b > 0 ? a / b : undefined)

export function metrics(r: CampaignNumbers) {
  const cpm = r.impressions > 0 ? (r.spend / r.impressions) * 1000 : undefined
  return {
    frequency: ratio(r.impressions, r.reach),
    cpm,
    ctr: ratio(r.clicks, r.impressions),
    cpc: ratio(r.spend, r.clicks),
    cr: ratio(r.leads, r.clicks),
    cpl: ratio(r.spend, r.leads),
    leadToSale: ratio(r.sales, r.leads),
    cac: ratio(r.spend, r.sales),
    roas: ratio(r.revenue, r.spend),
  }
}

/** Потолки из брифа: «в ноль» и целевые (доля от потолка цены клиента). */
export function briefEconomy(b: ProjectBrief) {
  const profit = b.avgCheck * (b.marginPct / 100)
  const targetCac = profit * (b.targetCacPct / 100)
  const leadToSale = b.leadToSalePct / 100
  const clickToLead = b.clickToLeadPct / 100
  return {
    profit,
    maxCac: profit,
    targetCac,
    maxCpl: profit * leadToSale,
    targetCpl: targetCac * leadToSale,
    maxCpc: profit * leadToSale * clickToLead,
    targetCpc: targetCac * leadToSale * clickToLead,
    testBudget: targetCac * leadToSale * 10,
  }
}

export type Diagnosis = { tone: 'gain' | 'loss'; title: string; text: string }

/** Идём по воронке слева направо и называем самое узкое место. Минимум данных — иначе вывод будет случайным. */
export function diagnose(r: CampaignNumbers, b: ProjectBrief): Diagnosis {
  const m = metrics(r)
  const e = briefEconomy(b)
  if (r.impressions < 1000 || r.clicks < 20) {
    return { tone: 'gain', title: 'Данных пока мало', text: 'Меньше 1000 показов или 20 кликов. Выводы по таким цифрам случайны: дай кампании открутиться и не меняй настройки.' }
  }
  if (m.frequency !== undefined && m.frequency > 4) {
    return { tone: 'loss', title: 'Креатив выгорает', text: `Частота ${dec(m.frequency, 1)}: один человек видит рекламу слишком часто. Подготовь 2–3 новых креатива с другим углом и только потом отключай старый.` }
  }
  if (m.ctr !== undefined && m.ctr < 0.008) {
    return { tone: 'loss', title: 'Реклама не цепляет', text: `CTR ${dec(m.ctr * 100, 2)}%, ниже рабочего ориентира 0,8%. Меняй концепцию и хук: первые 3 секунды видео или заголовок картинки.` }
  }
  if (m.cr !== undefined && m.cr < 0.02) {
    return { tone: 'loss', title: 'Люди кликают, но не оставляют заявку', text: `Из кликов в заявку доходит ${dec(m.cr * 100, 1)}%. Проверь посадочную с телефона: скорость, совпадение с обещанием в рекламе, понятный первый экран.` }
  }
  if (r.leads >= 5 && m.leadToSale !== undefined && m.leadToSale < (b.leadToSalePct / 100) * 0.5) {
    return { tone: 'loss', title: 'Заявки есть, продаж мало', text: `В продажу доходит ${(m.leadToSale * 100).toFixed(0)}% заявок при плане ${b.leadToSalePct}%. Проверь скорость ответа и качество заявок, добавь квалифицирующий вопрос в форму.` }
  }
  if (r.sales > 0 && m.cac !== undefined && m.cac > e.maxCac) {
    return { tone: 'loss', title: 'Клиент дороже прибыли', text: `Клиент стоит ${Math.round(m.cac)} ₸, а прибыль с продажи ${Math.round(e.maxCac)} ₸. Масштабировать рано: сначала снижай цену заявки или поднимай чек.` }
  }
  if (r.leads > 0 && m.cpl !== undefined && m.cpl > e.maxCpl) {
    return { tone: 'loss', title: 'Заявка дороже потолка', text: `Заявка стоит ${Math.round(m.cpl)} ₸ при потолке ${Math.round(e.maxCpl)} ₸. Тестируй новый оффер и креатив, бюджет пока не поднимай.` }
  }
  if (r.sales > 0 && m.cac !== undefined && m.cac <= e.targetCac) {
    return { tone: 'gain', title: 'Можно растить', text: `Клиент стоит ${Math.round(m.cac)} ₸ при цели ${Math.round(e.targetCac)} ₸. Если так идёт две недели и частота ниже 3, подними бюджет на 20% и держи запас креативов.` }
  }
  return { tone: 'gain', title: 'Кампания в рабочем коридоре', text: 'Узких мест не видно. Держи бюджет, собирай данные и запускай один новый тест креатива в неделю.' }
}
