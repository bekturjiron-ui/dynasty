import { useEffect, useState } from 'react'
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

/**
 * Кнопка версии в шапке ресурсов + окно «Что нового».
 * При появлении новой версии в content/changelog.json окно открывается один раз автоматически;
 * по нажатию на кнопку версии его всегда можно открыть снова и перепрочитать изменения.
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
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
      {open && <ChangelogDialog releases={releases} onClose={close} />}
    </>
  )
}

function ChangelogDialog({ releases, onClose }: { releases: Release[]; onClose: () => void }) {
  const [latest, ...older] = releases
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/75 backdrop-blur-[2px] md:items-center md:justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Что нового в версии ${latest.version}`}
    >
      <div
        className="pb-safe animate-rise surface flex max-h-[85dvh] w-full flex-col rounded-t-3xl border-t border-gold/35 px-5 pt-5 md:max-w-md md:rounded-3xl md:border md:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label>Что нового</Label>
            <div className="mt-1 flex items-baseline gap-2">
              <h2 className="gold-text font-serif text-[26px] leading-none">Версия {latest.version}</h2>
              <span className="text-[12px] tabular-nums text-muted">{fmtDate(latest.date)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[18px] leading-none text-muted transition-colors hover:text-parch"
          >
            ×
          </button>
        </div>

        <div className="mt-4 overflow-y-auto pr-1">
          <div className="rounded-2xl border border-gold/25 bg-gold/5 p-3.5">
            <div className="text-[15px] font-semibold text-parch">{latest.title}</div>
            <ul className="mt-2.5 space-y-2 text-[14px] leading-relaxed text-parch/90">
              {latest.changes.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {older.length > 0 && (
            <div className="mt-4 space-y-3">
              <Label>Прошлые обновления</Label>
              {older.map((rel) => (
                <div key={rel.version} className="rounded-2xl border border-line/70 bg-panel/70 p-3.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-semibold text-gold-soft">v{rel.version} · {rel.title}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted">{fmtDate(rel.date)}</span>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-muted">
                    {rel.changes.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-muted/70" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 pt-1">
          <Button full onClick={onClose}>Понятно</Button>
        </div>
      </div>
    </div>
  )
}
