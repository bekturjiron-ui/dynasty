import { evaluate, type Scope } from './expr'
import { fmtNum, fmtPct, fmtTg } from './format'

/** Подставляет {{выражение}} / {{выражение|tg}} / {{выражение|pct}} / {{выражение|int}} в текст. */
export function render(text: string, scope: Scope): string {
  return text.replace(/\{\{(.+?)\}\}/g, (_, body: string) => {
    let expr = body.trim()
    let fmt = ''
    const m = /^(.*?)\|\s*(tg|pct|num|int)$/.exec(expr)
    if (m) { expr = m[1].trim(); fmt = m[2] }
    try {
      const v = evaluate(expr, scope)
      if (typeof v !== 'number') return String(v)
      if (fmt === 'tg') return fmtTg(v)
      if (fmt === 'pct') return fmtPct(v)
      if (fmt === 'int') return fmtNum(Math.round(v))
      return fmtNum(v)
    } catch {
      return `⟨${expr}⟩`
    }
  })
}

/** Есть ли в тексте шаблоны, которые не удалось посчитать (для валидатора). */
export const hasBrokenTemplate = (s: string) => s.includes('⟨')
