import { useMemo, useState } from 'react'
import { content as baseContent } from '../../content'
import type { Mission, Week } from '../../content/schema'
import { resetPlan, savePlan, setMentorPin, setPlanOffset, syncRank } from '../../game/engine'
import { downloadBlob } from '../../game/backup'
import { blankWeek, deadlineOf, parsePlanFile, planToFile, renumber, weekKey } from '../../game/plan'
import type { Game } from '../../game/useGame'
import { dayKey } from '../../lib/dates'
import { Grip, Sortable } from '../../components/Sortable'
import { Advisor, Button, Card, Icon, Label } from '../../components/ui'

const input = 'min-h-11 w-full rounded-xl border border-line bg-ink px-3 text-[15px] text-parch outline-none focus:border-gold'

export function PlanEditor({ game, onClose }: { game: Game; onClose: () => void }) {
  const p = game.player!
  const [weeks, setWeeks] = useState<Week[]>(() => renumber(game.content.weeks))
  const [missions, setMissions] = useState<Mission[]>(() => game.content.missions)
  const [offset, setOffset] = useState(p.planOffsetWeeks ?? 0)
  const [open, setOpen] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ tone: 'gain' | 'loss'; text: string } | null>(null)
  const [newPin, setNewPin] = useState('')
  const [dirty, setDirty] = useState(false)
  const acts = useMemo(() => [...new Set(weeks.map((w) => w.act))], [weeks])

  const change = (ws: Week[]) => { setWeeks(renumber(ws)); setDirty(true) }
  const patch = (key: number, f: Partial<Week>) => change(weeks.map((w) => (weekKey(w) === key ? { ...w, ...f } : w)))

  async function save() {
    await savePlan(weeks, missions, baseContent.weeks, baseContent.missions)
    await syncRank(baseContent)
    if (offset !== (p.planOffsetWeeks ?? 0)) await setPlanOffset(offset)
    setDirty(false)
    setMsg({ tone: 'gain', text: 'План сохранён. Игрок увидит его сразу.' })
  }
  function moveLesson(id: string, fromKey: number, toKey: number) {
    change(weeks.map((w) => {
      const k = weekKey(w)
      if (k === fromKey) return { ...w, lessonIds: w.lessonIds.filter((x) => x !== id) }
      if (k === toKey) return { ...w, lessonIds: [...w.lessonIds, id] }
      return w
    }))
  }
  function removeWeek(w: Week) {
    const k = weekKey(w)
    const done = game.st.contracts.has(k)
    if (w.lessonIds.length) { setMsg({ tone: 'loss', text: `В неделе ${w.n} есть уроки — сначала перенеси их в другие недели.` }); return }
    if (!confirm(`Удалить неделю ${w.n} «${w.title}»?${done ? ' Её контракт уже сдан — он останется в истории.' : ''}`)) return
    change(weeks.filter((x) => weekKey(x) !== k))
    setMissions((ms) => ms.filter((m) => m.weekKey !== k))
    setOpen(null)
  }
  async function onImport(f?: File) {
    if (!f) return
    try {
      const r = parsePlanFile(await f.text(), baseContent)
      setWeeks(r.weeks); setMissions(r.missions); setDirty(true)
      setMsg({ tone: 'gain', text: `План из файла загружен: ${r.weeks.length} недель, ${r.missions.length} миссий. Проверь и нажми «Сохранить».${r.warnings.length ? ' ' + r.warnings.join('; ') : ''}` })
    } catch (e) {
      setMsg({ tone: 'loss', text: `Файл не подошёл: ${(e as Error).message}` })
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur">
        <button onClick={() => { if (!dirty || confirm('Выйти без сохранения?')) onClose() }} className="flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-panel" aria-label="Закрыть редактор"><Icon name="close" /></button>
        <div className="flex-1 font-serif text-[20px]">Редактор плана</div>
        <Button className="min-h-10 px-4" disabled={!dirty} onClick={save}>Сохранить</Button>
      </div>
      {msg && <Advisor tone={msg.tone}>{msg.text}</Advisor>}

      <Card className="space-y-2">
        <Label>Темп</Label>
        <p className="text-[13px] text-muted">Растянуть план — сдвинуть текущую неделю, дедлайны и график «Дома Вернеров».</p>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="min-h-10 w-12 px-0" onClick={() => { setOffset((o) => Math.max(0, o - 1)); setDirty(true) }} disabled={offset === 0}>−</Button>
          <div className="flex-1 text-center"><span className="text-[22px] font-semibold text-gold">{offset}</span> <span className="text-muted">нед.</span></div>
          <Button variant="ghost" className="min-h-10 w-12 px-0" onClick={() => { setOffset((o) => Math.min(12, o + 1)); setDirty(true) }}>+</Button>
        </div>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <Label>Недели · тяни за ⋮⋮</Label>
        <span className="text-[12px] text-muted">{weeks.length} нед.</span>
      </div>
      <Sortable
        className="space-y-2"
        items={weeks}
        keyOf={weekKey}
        onChange={change}
        render={(w, _i, h) => {
          const k = weekKey(w)
          const isOpen = open === k
          const ms = missions.filter((m) => m.weekKey === k)
          return (
            <div className={`rounded-2xl border ${h.dragging ? 'border-gold' : 'border-line'} bg-panel`}>
              <div className="flex items-center gap-1 pr-2">
                <span {...h.handle} className="flex h-14 w-10 items-center justify-center"><Grip /></span>
                <button className="flex flex-1 items-center gap-3 py-3 text-left" onClick={() => setOpen(isOpen ? null : k)}>
                  <span className="w-6 text-center text-[14px] font-semibold text-gold">{w.n}</span>
                  <span className="flex-1">
                    <span className="block text-[14px] leading-snug">{w.title}</span>
                    <span className="block text-[11px] text-muted">{w.act} · уроков {w.lessonIds.length}{ms.length ? ` · миссий ${ms.length}` : ''}</span>
                  </span>
                </button>
                <div className="flex flex-col">
                  <button onClick={h.up} disabled={!h.up} className="px-2 text-muted disabled:opacity-20" aria-label="Выше">▲</button>
                  <button onClick={h.down} disabled={!h.down} className="px-2 text-muted disabled:opacity-20" aria-label="Ниже">▼</button>
                </div>
              </div>

              {isOpen && (
                <div className="space-y-3 border-t border-line p-4">
                  <label className="block"><span className="text-[12px] text-muted">Тема недели</span>
                    <input className={input} value={w.title} onChange={(e) => patch(k, { title: e.target.value })} /></label>
                  <label className="block"><span className="text-[12px] text-muted">Акт</span>
                    <input className={input} list="acts" value={w.act} onChange={(e) => patch(k, { act: e.target.value })} /></label>
                  <label className="block"><span className="text-[12px] text-muted">Дедлайн (пусто — по графику: {new Date(deadlineOf({ ...w, deadline: undefined }, p.startedAt, offset)).toLocaleDateString('ru-RU')})</span>
                    <div className="flex gap-2">
                      <input type="date" className={input} value={w.deadline ?? ''} min={dayKey()} onChange={(e) => patch(k, { deadline: e.target.value || undefined })} />
                      {w.deadline && <Button variant="quiet" className="min-h-11 px-3" onClick={() => patch(k, { deadline: undefined })}>Сброс</Button>}
                    </div></label>
                  <label className="block"><span className="text-[12px] text-muted">Реальный контракт</span>
                    <textarea rows={3} className={`${input} py-2`} value={w.contract.text} onChange={(e) => patch(k, { contract: { ...w.contract, text: e.target.value } })} /></label>
                  <div className="flex gap-2">
                    <label className="block flex-1"><span className="text-[12px] text-muted">Пруф</span>
                      <select className={input} value={w.contract.proof} onChange={(e) => patch(k, { contract: { ...w.contract, proof: e.target.value as Week['contract']['proof'] } })}>
                        <option value="photo">Фото / скриншот</option><option value="number">Число</option><option value="checkbox">Галочка</option>
                      </select></label>
                    {w.contract.proof === 'number' && (
                      <label className="block flex-1"><span className="text-[12px] text-muted">Что за число</span>
                        <input className={input} value={w.contract.numberLabel ?? ''} onChange={(e) => patch(k, { contract: { ...w.contract, numberLabel: e.target.value || undefined } })} /></label>
                    )}
                  </div>
                  {game.st.contracts.has(k) && <p className="text-[12px] text-gain">Контракт этой недели уже сдан игроком.</p>}

                  {w.lessonIds.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[12px] text-muted">Уроки недели</span>
                      <Sortable
                        className="space-y-1"
                        items={w.lessonIds}
                        keyOf={(id) => id}
                        onChange={(ids) => patch(k, { lessonIds: ids })}
                        render={(id, _j, hh) => (
                          <div className="flex items-center gap-1 rounded-xl bg-panel2 pr-2">
                            <span {...hh.handle} className="flex h-11 w-8 items-center justify-center"><Grip /></span>
                            <span className="flex-1 text-[13px] leading-snug">{baseContent.lessons[id]?.title ?? id}</span>
                            <select aria-label="Перенести урок в неделю" className="rounded-lg border border-line bg-ink px-1 py-1 text-[12px] text-muted" value={k} onChange={(e) => moveLesson(id, k, Number(e.target.value))}>
                              {weeks.map((x) => <option key={weekKey(x)} value={weekKey(x)}>нед. {x.n}</option>)}
                            </select>
                          </div>
                        )}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <span className="text-[12px] text-muted">Свои миссии</span>
                    {ms.map((m) => (
                      <div key={m.id} className="flex items-start gap-2 rounded-xl bg-panel2 p-3">
                        <div className="flex-1 text-[13px]">
                          <div className="text-parch">{m.title}</div>
                          <div className="text-muted">{m.check === 'photo' ? 'фото' : m.check === 'number' ? 'число' : 'галочка'} · +{m.reward.xp} XP{m.reward.capital ? ` · +${m.reward.capital} ₸` : ''}{game.st.missions.has(m.id) ? ' · выполнена' : ''}</div>
                        </div>
                        <button className="text-[12px] text-loss" onClick={() => { setMissions((xs) => xs.filter((x) => x.id !== m.id)); setDirty(true) }}>Удалить</button>
                      </div>
                    ))}
                    <MissionForm weekKey={k} onAdd={(m) => { setMissions((xs) => [...xs, m]); setDirty(true) }} />
                  </div>

                  <Button variant="quiet" full className="text-loss" onClick={() => removeWeek(w)}>Удалить неделю</Button>
                </div>
              )}
            </div>
          )
        }}
      />
      <datalist id="acts">{acts.map((a) => <option key={a} value={a} />)}</datalist>
      <Button variant="ghost" full onClick={() => { const nw = blankWeek(weeks, weeks[weeks.length - 1]?.act ?? 'Новый акт'); change([...weeks, nw]); setOpen(weekKey(nw)) }}>+ Добавить неделю</Button>

      <Card className="space-y-2">
        <Label>Файл плана</Label>
        <p className="text-[13px] text-muted">Собери план у себя, сохрани файлом и отправь другу — он загрузит его здесь.</p>
        <Button variant="ghost" full onClick={() => downloadBlob(planToFile(weeks, missions), `dynasty-plan-${dayKey()}.json`)}>Скачать план</Button>
        <label className="block">
          <span className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl text-[15px] text-muted active:bg-panel2">Загрузить план из файла</span>
          <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
        </label>
        <Button variant="quiet" full onClick={async () => { if (confirm('Вернуть стандартный план на 12 недель? Свои миссии и правки пропадут; прогресс игрока сохранится.')) { await resetPlan(); onClose() } }}>Вернуть стандартный план</Button>
      </Card>

      <Card className="space-y-2">
        <Label>PIN наставника</Label>
        <div className="flex gap-2">
          <input inputMode="numeric" type="password" placeholder="Новый PIN, 4–8 цифр" value={newPin} maxLength={8} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} className={input} />
          <Button className="min-h-11 px-4" disabled={newPin.length < 4} onClick={async () => { await setMentorPin(newPin); setNewPin(''); setMsg({ tone: 'gain', text: 'PIN изменён.' }) }}>OK</Button>
        </div>
        {(game.settings.mentorPin || '0000') === '0000' && <p className="text-[12px] text-loss">Сейчас стоит PIN по умолчанию 0000 — смени его.</p>}
      </Card>
    </div>
  )
}

function MissionForm({ weekKey: k, onAdd }: { weekKey: number; onAdd: (m: Mission) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [check, setCheck] = useState<Mission['check']>('photo')
  const [numberLabel, setNumberLabel] = useState('')
  const [xp, setXp] = useState('50')
  const [capital, setCapital] = useState('100')
  if (!open) return <Button variant="ghost" full onClick={() => setOpen(true)}>+ Своя миссия</Button>
  const ok = title.trim() && Number(xp) >= 0 && Number(xp) <= 1000 && Number(capital) >= 0 && Number(capital) <= 5000
  return (
    <div className="space-y-2 rounded-xl border border-gold/30 p-3">
      <input className={input} placeholder="Название, например «Ответить на 5 отзывов»" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea rows={2} className={`${input} py-2`} placeholder="Что именно сделать и как проверить" value={description} onChange={(e) => setDescription(e.target.value)} />
      <select className={input} value={check} onChange={(e) => setCheck(e.target.value as Mission['check'])}>
        <option value="photo">Проверка: фото / скриншот</option><option value="number">Проверка: число</option><option value="checkbox">Проверка: галочка</option>
      </select>
      {check === 'number' && <input className={input} placeholder="Что за число (например, «Ответов отправлено»)" value={numberLabel} onChange={(e) => setNumberLabel(e.target.value)} />}
      <div className="flex gap-2">
        <label className="flex-1 text-[12px] text-muted">XP<input inputMode="numeric" className={input} value={xp} onChange={(e) => setXp(e.target.value.replace(/\D/g, ''))} /></label>
        <label className="flex-1 text-[12px] text-muted">Капитал ₸<input inputMode="numeric" className={input} value={capital} onChange={(e) => setCapital(e.target.value.replace(/\D/g, ''))} /></label>
      </div>
      <div className="flex gap-2">
        <Button variant="quiet" onClick={() => setOpen(false)}>Отмена</Button>
        <Button full disabled={!ok} onClick={() => {
          onAdd({ id: `m-${Date.now().toString(36)}`, weekKey: k, title: title.trim(), description: description.trim(), check, numberLabel: numberLabel.trim() || undefined, reward: { xp: Number(xp), capital: Number(capital) } })
          setOpen(false); setTitle(''); setDescription('')
        }}>Добавить</Button>
      </div>
    </div>
  )
}
