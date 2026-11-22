import type { ReactNode } from 'react'
import type { ArsenalSkill } from '../../content/schema'
import { GROUPS, LEVEL_NAMES, type SkillState } from '../../game/skills'
import { Icon } from '../../components/ui'

/** Кольцо прогресса вокруг иконки навыка. */
export function SkillRing({ ratio, color, size, children }: { ratio: number; color: string; size: number; children: ReactNode }) {
  const r = (size - 8) / 2
  const len = 2 * Math.PI * r
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - Math.max(0, Math.min(1, ratio)))} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      {children}
    </div>
  )
}

/** Карточка навыка: иконка в кольце, уровень, прогресс. Не начатые приглушены. */
export function SkillCard({ skill, state, onOpen }: { skill: ArsenalSkill; state: SkillState; onOpen: () => void }) {
  const g = GROUPS[skill.group]
  const started = state.level > 0
  return (
    <button onClick={onOpen} className={`choice surface relative flex flex-col items-center rounded-2xl border p-4 text-center ${state.level === 3 ? 'border-gold/60' : 'border-line'} ${started ? '' : 'opacity-75'}`}>
      <SkillRing ratio={state.ratio} color={g.ring} size={72}>
        <span className={`grid h-12 w-12 place-items-center rounded-full ${g.tint} ${g.text}`}><Icon name={skill.icon} size={26} /></span>
      </SkillRing>
      <div className="mt-3 text-[15px] font-semibold leading-tight">{skill.title}</div>
      <div className="mt-1 text-[12px] leading-snug text-muted">{skill.tagline}</div>
      <div className="mt-3 flex items-center gap-1" aria-label={`Уровень ${state.level}`}>
        {[1, 2, 3].map((i) => <span key={i} className={`h-1.5 w-5 rounded-full ${i <= state.level ? 'bg-gold' : 'bg-white/10'}`} />)}
      </div>
      <div className="mt-1 text-[11px] text-muted">
        {state.total ? (started ? `${LEVEL_NAMES[state.level]} · ${state.done}/${state.total}` : `Неделя ${state.firstWeek ?? ''} · ${state.total} уроков`) : 'Готовится'}
      </div>
    </button>
  )
}
