// Проверка текста объявления: длина, правила площадки, обязательные слова. Чистая функция, её гоняет и валидатор.
import type { AdRule, TextCheck } from './schema'

/** Аббревиатуры, которые капсом писать можно. */
const ALLOWED_CAPS = new Set(['CRM', 'SMM', 'UTM', 'CPM', 'CPL', 'CPC', 'CTR', 'ROAS', 'ROMI', 'SPF', 'PDF', 'FAQ', 'ИП', 'ТОО', 'РК', 'США', 'ДНК'])

/** Слово целиком: \b в JS не понимает кириллицу. */
const word = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, 'iu')

const RULES: Record<AdRule, { test: (t: string) => boolean; text: string }> = {
  caps: {
    test: (t) => (t.match(/[\p{Lu}]{4,}/gu) ?? []).some((w) => !ALLOWED_CAPS.has(w)),
    text: 'Слово капсом модерация отклонит. Оставь заглавные только для аббревиатур.',
  },
  exclaim: { test: (t) => t.includes('!'), text: 'Восклицательный знак выглядит как кликбейт. Сильный текст обходится без него.' },
  guarantee: {
    test: (t) => /гарант|100\s*%|навсегда|за один день|гаранти/iu.test(t),
    text: 'Обещание гарантированного результата площадка не пропустит. Опиши, что человек получит, без гарантий.',
  },
  personal: {
    test: (t) => /(у\s+вас|ваш[аеи]?|ваши)\s+(\p{L}+\s+)?(прыщ|акне|морщин|лишн|долг|целлюлит|перхот|выпаден)/iu.test(t),
    text: 'Текст намекает на личный недостаток человека. Meta и Telegram такое отклоняют. Говори о пользе продукта.',
  },
  informal: {
    test: (t) => word('ты|тебя|тебе|тобой|твой|твоя|твоё|твое|твои|твоих|твоим').test(t),
    text: 'Обращение на «ты» модерация Telegram часто отклоняет. Перепиши на «вы» или без обращения.',
  },
  spaces: { test: (t) => /\s{2,}|\n|\s[,.:;?]/.test(t), text: 'Лишние пробелы или перенос строки. Telegram проверяет оформление вручную.' },
}

export type AdIssue = { text: string }

export function checkAd(raw: string, c: TextCheck): AdIssue[] {
  const t = raw.trim()
  const issues: AdIssue[] = []
  if (t.length > c.maxLength) issues.push({ text: `В тексте ${t.length} знаков, лимит ${c.maxLength}. Убери ${t.length - c.maxLength}.` })
  if (t.length < c.minLength) issues.push({ text: `Пока ${t.length} знаков. Для объявления нужно хотя бы ${c.minLength}: кому, какая польза и следующий шаг.` })
  for (const r of c.rules) if (RULES[r].test(t)) issues.push({ text: RULES[r].text })
  const low = t.toLowerCase()
  for (const g of c.mustInclude) if (!g.any.some((w) => low.includes(w.toLowerCase()))) issues.push({ text: `Не хватает: ${g.label}.` })
  return issues
}
