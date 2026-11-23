import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { downloadBlob, exportState, importState } from '../game/backup'
import { restartGame } from '../game/admin'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { Game } from '../game/useGame'
import { Button, Card, Label, Title } from '../components/ui'
import { ProjectBriefCard } from './council/ProjectBriefCard'
import { WeekReport } from './council/WeekReport'

export default function Council({ game }: { game: Game }) {
  const nav = useNavigate()
  const [msg, setMsg] = useState('')
  const [askRestart, setAskRestart] = useState(false)
  const [restarting, setRestarting] = useState(false)

  async function onImport(f?: File) {
    if (!f) return
    if (!confirm('Заменить весь прогресс на данные из файла? Текущий прогресс на этом телефоне пропадёт.')) return
    try { await importState(f); setMsg('Бэкап восстановлен.') } catch (e) { setMsg(`Не получилось: ${(e as Error).message}`) }
  }

  return (
    <div className="stagger space-y-5">
      <div className="pt-2">
        <Title>Совет Дома</Title>
        <p className="mt-1 text-[14px] text-muted">Раз в неделю Дом сверяет рекламу с деньгами: сколько потрачено, что принесло заявки и где узкое место.</p>
      </div>

      <ProjectBriefCard game={game} />
      <WeekReport game={game} />

      <div className="pt-2"><Label>Настройки Дома</Label></div>

      <Card className="space-y-3">
        <Label>Бэкап</Label>
        <p className="text-[13px] text-muted">Весь прогресс живёт только на этом телефоне. Раз в неделю сохраняй файл: в «Файлы» или себе в Telegram.</p>
        <Button variant="ghost" full onClick={async () => downloadBlob(await exportState())}>Сохранить бэкап</Button>
        <label className="block">
          <span className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl text-[15px] text-muted active:bg-panel2">Восстановить из файла</span>
          <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
        </label>
        {msg && <p className="text-[13px] text-gold">{msg}</p>}
      </Card>

      <Card className="space-y-3">
        <Label>Рестарт</Label>
        <p className="text-[13px] leading-relaxed text-muted">Начать игру заново: прогресс, титулы, постройки и Капитал обнулятся. Остаются имя Дома, бриф проекта и правки плана. Перед рестартом сохрани бэкап.</p>
        <button onClick={() => setAskRestart(true)} className="min-h-12 w-full rounded-xl border border-loss/60 text-[15px] font-semibold text-loss active:bg-loss/10">Рестарт игры…</button>
      </Card>

      <button onClick={() => nav('/admin')} className="w-full py-2 text-center text-[13px] text-muted underline-offset-4 active:underline">Админ-панель</button>

      <Card className="space-y-2 text-[14px] leading-relaxed text-muted">
        <Label>Напоминание</Label>
        <p>Push-уведомлений в этой версии нет. Поставь в «Напоминаниях» iPhone ежедневное напоминание со ссылкой на игру, например на 20:00.</p>
      </Card>
      {askRestart && <ConfirmDialog title="Начать игру заново?" text="Весь прогресс, титулы, постройки и Капитал будут удалены. Бриф проекта останется." confirmLabel="Подтвердить рестарт" busyLabel="Перезапускаю…" busy={restarting} onConfirm={async () => { setRestarting(true); await restartGame(); setAskRestart(false); setRestarting(false); nav('/') }} onCancel={() => setAskRestart(false)} />}
    </div>
  )
}
