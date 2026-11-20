import type { Scope } from '../lib/expr'

/** Перезапуск босса «с другими цифрами»: выбранные переменные меняются на ±30% и округляются по-человечески. */
export function jitterVars(scope: Scope, names: string[], rnd: () => number = Math.random): Scope {
  const out: Scope = { ...scope }
  for (const n of names) {
    const v = out[n]
    if (typeof v !== 'number') continue
    const k = 0.7 + rnd() * 0.6
    const step = Math.abs(v) >= 1000 ? 10 : 1
    out[n] = Math.max(1, Math.round((v * k) / step) * step)
  }
  return out
}
