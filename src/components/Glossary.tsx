import { createContext, useContext, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { content } from '../content'
import type { Term, TermCategory } from '../content/schema'
import { Button, Icon, Label } from './ui'

export const TERM_CATEGORIES: Record<TermCategory, string> = {
  metrics: 'Метрики и экономика',
  meta: 'Meta и Instagram',
  telegram: 'Telegram и блогеры',
  creative: 'Креативы и тексты',
  analytics: 'Аналитика и трекинг',
  basics: 'Базовые понятия',
}

type GlossaryCtx = {
  openTerm: (termOrId: Term | string) => void
  close: () => void
  active: Term | null
}

const Ctx = createContext<GlossaryCtx>({ openTerm: () => {}, close: () => {}, active: null })

export function useGlossary() {
  return useContext(Ctx)
}

/** Провайдер словаря: хранит открытый термин и рисует окно расшифровки поверх всех экранов. */
export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Term | null>(null)
  const byId = useMemo(() => new Map(content.glossary.map((t) => [t.id, t])), [])

  useEffect(() => {
    if (!active) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  const value = useMemo<GlossaryCtx>(() => ({
    active,
    close: () => setActive(null),
    openTerm: (t) => {
      const found = typeof t === 'string' ? byId.get(t) ?? null : t
      if (found) setActive(found)
    },
  }), [active, byId])

  return (
    <Ctx.Provider value={value}>
      {children}
      {active && createPortal(<TermModal term={active} onClose={() => setActive(null)} />, document.body)}
    </Ctx.Provider>
  )
}

// ---------- Поиск и разметка терминов в тексте ----------

const WORD_CHAR = /[A-Za-zА-Яа-яЁё0-9_]/

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type CompiledGlossary = {
  regex: RegExp | null
  lookup: Map<string, Term>
}

const compiled: CompiledGlossary = (() => {
  const lookup = new Map<string, Term>()
  const keys: string[] = []
  for (const t of content.glossary) {
    const forms = t.aliases?.length ? t.aliases : [t.term]
    for (const f of forms) {
      if (!lookup.has(f)) {
        lookup.set(f, t)
        keys.push(f)
      }
    }
  }
  if (!keys.length) return { regex: null, lookup }
  // Сначала длинные фразы («Conversions API», «Meta Pixel», «TCPL»), потом короткие («API», «CPL», «CR»)
  keys.sort((a, b) => b.length - a.length)
  return { regex: new RegExp(keys.map(escapeRe).join('|'), 'g'), lookup }
})()

export type TextPart = string | { raw: string; term: Term }

/** Разбивает текст на обычные фрагменты и найденные термины словаря. */
export function splitTerms(text: string, excludeId?: string): TextPart[] {
  if (!text || !compiled.regex) return [text]
  const out: TextPart[] = []
  let last = 0
  compiled.regex.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = compiled.regex.exec(text)) !== null) {
    const start = m.index
    const raw = m[0]
    const end = start + raw.length
    const prev = start > 0 ? text[start - 1] : ''
    const next = end < text.length ? text[end] : ''
    // Границы слова без lookbehind — стабильно работает в любом iOS Safari
    if ((prev && WORD_CHAR.test(prev)) || (next && WORD_CHAR.test(next))) continue
    const term = compiled.lookup.get(raw)
    if (!term || term.id === excludeId) continue
    if (start > last) out.push(text.slice(last, start))
    out.push({ raw, term })
    last = end
  }
  if (last === 0) return [text]
  if (last < text.length) out.push(text.slice(last))
  return out
}

const TERM_CLS =
  'inline cursor-pointer rounded-sm border-b border-dashed border-gold/65 px-[1px] text-gold-soft transition-colors hover:border-gold hover:bg-gold/10 active:bg-gold/20 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gold'

/** Текст с кликабельными терминами. Внутри <button> ставь interactiveParent, чтобы тап по термину не нажимал родительскую кнопку. */
export function TermText({ text, excludeId, interactiveParent }: { text: string; excludeId?: string; interactiveParent?: boolean }) {
  const { openTerm } = useGlossary()
  const parts = useMemo(() => splitTerms(text, excludeId), [text, excludeId])

  if (parts.length === 1 && typeof parts[0] === 'string') return <>{parts[0]}</>

  function onTap(e: MouseEvent, term: Term) {
    e.stopPropagation()
    e.preventDefault()
    openTerm(term)
  }
  function onKey(e: KeyboardEvent, term: Term) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation()
      e.preventDefault()
      openTerm(term)
    }
  }

  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : interactiveParent ? (
          <span
            key={i}
            role="button"
            tabIndex={0}
            title={`${p.term.term} — ${p.term.full} (${p.term.ru})`}
            onClick={(e) => onTap(e, p.term)}
            onKeyDown={(e) => onKey(e, p.term)}
            className={TERM_CLS}
          >
            {p.raw}
          </span>
        ) : (
          <button
            key={i}
            type="button"
            title={`${p.term.term} — ${p.term.full} (${p.term.ru})`}
            onClick={(e) => onTap(e, p.term)}
            className={TERM_CLS}
          >
            {p.raw}
          </button>
        ),
      )}
    </>
  )
}

/** Модальное окно / шторка расшифровки термина. */
function TermModal({ term, onClose }: { term: Term; onClose: () => void }) {
  const showFull = term.full.toLowerCase() !== term.term.toLowerCase()
  const showRuSeparately = term.ru.toLowerCase() !== term.full.toLowerCase()

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end bg-black/75 backdrop-blur-[2px] md:items-center md:justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${term.term} — расшифровка термина`}
    >
      <div
        className="animate-rise max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border-t border-gold/45 bg-panel px-5 pt-3 pb-[max(env(safe-area-inset-bottom),20px)] shadow-[0_-12px_40px_rgba(0,0,0,0.85)] md:max-w-lg md:rounded-3xl md:border md:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line md:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Label tone="gold">{TERM_CATEGORIES[term.category]}</Label>
            <h2 className="mt-1 font-serif text-[24px] leading-snug text-parch">
              <span className="text-gold-soft">{term.term}</span>
              {showFull && (
                <>
                  <span className="mx-2 text-muted">—</span>
                  <span>{term.full}</span>
                </>
              )}
            </h2>
            {showRuSeparately && (
              <p className="mt-1 text-[15px] font-medium text-parch/90">{term.ru}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted active:bg-panel"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-white/[0.04] p-4">
          <Label>Что это значит</Label>
          <p className="mt-1.5 text-[16px] leading-relaxed text-parch">
            <TermText text={term.meaning} excludeId={term.id} />
          </p>
        </div>

        {term.formula && (
          <div className="mt-3 rounded-2xl border border-gold/30 bg-gold/[0.06] px-4 py-3">
            <Label tone="gold">Формула</Label>
            <p className="mt-1 font-mono text-[14px] leading-relaxed text-gold-soft break-words">
              <TermText text={term.formula} excludeId={term.id} />
            </p>
          </div>
        )}

        <Button full className="mt-5" onClick={onClose}>Понятно</Button>
      </div>
    </div>
  )
}
