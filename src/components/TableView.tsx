import { addr, colLetter, displayCell, isFormula, type Grid } from '../lib/sheet'

type Props = {
  grid: Grid
  highlight?: string[]
  /** Ячейки, которые игрок заполняет (тренажёр) */
  editable?: string[]
  selected?: string
  /** Ячейки, уже проверенные советником */
  verified?: string[]
  onSelect?: (a: string) => void
  /** Показывать строку формулы для выделенной/подсвеченной формулы */
  showFormulaBar?: boolean
}

/** Таблица в стиле Excel: буквы столбцов, номера строк, подсветка ячеек. */
export function TableView({ grid, highlight = [], editable = [], selected, verified = [], onSelect, showFormulaBar = true }: Props) {
  const rows = grid.length
  const cols = Math.max(...grid.map((r) => r.length), 1)
  const focusCell = selected ?? highlight.find((a) => {
    const m = /^([A-Z])(\d+)$/.exec(a)
    if (!m) return false
    return isFormula(grid[+m[2] - 1]?.[m[1].charCodeAt(0) - 65] ?? null)
  })
  const focusRaw = focusCell ? (() => { const m = /^([A-Z])(\d+)$/.exec(focusCell)!; return grid[+m[2] - 1]?.[m[1].charCodeAt(0) - 65] ?? null })() : null

  return (
    <div className="space-y-2">
      {showFormulaBar && (
        <div className="flex min-h-10 items-center gap-2 rounded-lg border border-line bg-ink px-3 font-mono text-[14px]">
          <span className="w-8 shrink-0 text-muted">{focusCell ?? ''}</span>
          <span className="text-muted">ƒx</span>
          <span className="truncate text-gold-soft">{focusRaw === null ? '' : String(focusRaw)}</span>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-panel2 text-muted">
              <th className="w-7 border-r border-b border-line" />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="border-r border-b border-line px-1 py-1 font-medium last:border-r-0">{colLetter(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <td className="border-r border-b border-line bg-panel2 text-center text-muted">{r + 1}</td>
                {Array.from({ length: cols }, (_, c) => {
                  const a = addr(r, c)
                  const d = displayCell(grid, r, c)
                  const isHl = highlight.includes(a)
                  const isEd = editable.includes(a)
                  const isSel = selected === a
                  const isOk = verified.includes(a)
                  const header = r === 0
                  return (
                    <td
                      key={c}
                      onClick={onSelect ? () => onSelect(a) : undefined}
                      className={[
                        'h-9 max-w-[7.5rem] border-r border-b border-line px-1.5 last:border-r-0 transition-colors',
                        d.isNum ? 'text-right tabular-nums' : 'text-left',
                        header ? 'font-semibold' : '',
                        // цвет текста — ровно один класс, чтобы не спорили между собой
                        d.error ? 'text-loss' : isOk ? 'text-gain' : isHl ? 'text-gold-soft' : header ? 'text-muted' : 'text-parch',
                        isHl ? 'bg-gold/20 outline outline-1 -outline-offset-1 outline-gold' : '',
                        isEd ? 'bg-gold/[0.06]' : '',
                        onSelect ? 'cursor-pointer' : '',
                        isSel ? 'outline outline-2 -outline-offset-2 outline-gold' : '',
                      ].join(' ')}
                    >
                      <div className="truncate">{d.text || (isEd ? <span className="text-gold/50">?</span> : '')}</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
