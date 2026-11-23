import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { content } from '../content'
import type { Release } from '../content/schema'
import { Button, Label } from './ui'

const SEEN_KEY = 'dynasty-seen-version'

function readSeen(): string | null {
  try { return localStorage.getItem(SEEN_KEY) } catch { return null }
}

function writeSeen(version: string) {
  try { localStorage.setItem(SEEN_KEY, version) } catch { /* приватный режим */ }
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}.${m}.${y}` : iso
}

/** Выделяет **ключевое** или заголовок до двоеточия золотым акцентом с мягким подчёркиванием. */
function renderChange(text: string): ReactNode {
  if (text.includes('**')) {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <span key={i} className="font-semibold text-gold-soft underline decoration-gold/45 underline-offset-4">
          {part.slice(2, -2)}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    )
  }
  const idx = text.indexOf(':')
  if (idx > 0 && idx < 64) {
    return (
      <>
        <span className="font-semibold text-gold-soft underline decoration-gold/45 underline-offset-4">
          {text.slice(0, idx)}
        </span>
        <span>{text.slice(idx)}</span>
      </>
    )
  }
  return text
}

/**
 * Кнопка версии в шапке ресурсов + окно «Что нового».
 * Рендерится в document.body через портал, чтобы backdrop-filter шапки не смещал модалку.
 */
export function VersionBadge() {
  const releases = content.changelog
  const latest = releases[0]
  const [seen, setSeen] = useState<string | null>(() => readSeen())
  const [open, setOpen] = useState<boolean>(() => Boolean(latest && readSeen() !== latest.version))

  const close = () => {
    setOpen(false)
    if (latest) {
      writeSeen(latest.version)
      setSeen(latest.version)
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, latest?.version])

  if (!latest) return null
  const isNew = seen !== latest.version

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Версия ${latest.version}: что нового`}
        title={`Версия ${latest.version} — история изменений`}
        className="relative flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-gold/30 bg-gold/10 px-2 py-1 text-[11px] font-semibold tabular-nums text-gold-soft transition-colors hover:border-gold/55 hover:bg-gold/15 active:scale-95"
      >
        <span>v{latest.version}</span>
        {isNew && <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />}
      </button>
      {open && createPortal(<ChangelogDialog releases={releases} onClose={close} />, document.body)}
    </>
  )
}

function ChangelogDialog({ releases, onClose }: { releases: Release[]; onClose: () => void }) {
  const [latest, ...older] = releases
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Что нового в версии ${latest.version}`}
    >
      <div
        className="animate-rise surface-gold relative flex max-h-[86dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-gold/40 p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-[18px] leading-none text-muted transition-colors hover:border-gold/40 hover:text-parch"
        >
          ×
        </button>

        <div className="pr-10">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-gold/45 bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wider text-gold-soft uppercase">
              Версия {latest.version}
            </span>
            <span className="text-[12px] tabular-nums text-muted">{fmtDate(latest.date)}</span>
          </div>
          <h2 className="gold-text mt-2.5 font-serif text-[28px] leading-[1.15] tracking-wide">
            {latest.title}
          </h2>
          <div className="mt-3 h-px w-full bg-gradient-to-r from-gold/60 via-gold/20 to-transparent" />
        </div>

        <div className="mt-4 overflow-y-auto pr-1">
          <ul className="space-y-2.5">
            {latest.changes.map((item, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-2xl border border-gold/20 bg-ink/55 px-3.5 py-3 text-[14px] leading-relaxed text-parch/95"
              >
                <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-gold shadow-[0_0_8px_rgba(216,170,66,0.8)]" aria-hidden="true" />
                <span>{renderChange(item)}</span>
              </li>
            ))}
          </ul>

          {older.length > 0 && (
            <div className="mt-5 space-y-2.5">
              <Label>Прошлые обновления</Label>
              {older.map((rel) => (
                <div key={rel.version} className="rounded-2xl border border-line/70 bg-ink/45 p-3.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-serif text-[16px] text-gold-soft">v{rel.version} · {rel.title}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted">{fmtDate(rel.date)}</span>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-muted">
                    {rel.changes.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-gold/60" aria-hidden="true" />
                        <span>{renderChange(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5">
          <Button full onClick={onClose}>Понятно</Button>
        </div>
      </div>
    </div>
  )
}
