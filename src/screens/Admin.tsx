import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { content } from '../content'
import { ADMIN_PIN, adjustPlayer, previewCeremony, resetAll, setAllBuildings, setRank } from '../game/admin'
import { downloadBlob, exportState } from '../game/backup'
import type { Game } from '../game/useGame'
import { fmtNum } from '../lib/format'
import { Button, Card, Icon, Label, Title } from '../components/ui'
import { ConfirmDialog } from '../components/ConfirmDialog'

const TIME_LABELS: Record<string, string> = { auto: 'Авто', day: 'День', dusk: 'Закат', night: 'Ночь' }
const chip = 'min-h-11 rounded-xl border border-line bg-white/[0.04] px-3 text-[14px] font-semibold active:bg-white/10'

export default function Admin({ game }: { game: Game }) {
  const nav = useNavigate()
  const p = game.player
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('dynasty-admin') === '1')
  const [pin, setPin] = useState('')
  const [pinErr, setPinErr] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [timeMode, setTimeMode] = useState<string>(() => localStorage.getItem('dynasty-time') ?? 'auto')

  function check() {
    if (pin === ADMIN_PIN) { sessionStorage.setItem('dynasty-admin', '1'); setUnlocked(true); setPin('') } else setPinErr(true)
  }
  async function doReset() {
    setBusy(true)
    await resetAll()
    sessionStorage.removeItem('dynasty-admin')
    window.location.hash = '#/'
    window.location.reload()
  }

  if (!unlocked) {
    return (
      <div className="stagger space-y-4">
        <div className="pt-2">
          <Title>Админ-панель</Title>
          <p className="mt-1 text-[14px] text-muted">Только для проверки игры. Введи PIN.</p>
        </div>
        <Card className="space-y-3">
          <input
            inputMode="numeric" type="password" autoComplete="off" value={pin} placeholder="PIN"
            onChange={(e) => { setPin(e.target.value); setPinErr(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') check() }}
            className={`min-h-12 w-full rounded-xl border bg-ink px-4 text-center text-[22px] tracking-[0.5em] outline-none ${pinErr ? 'border-loss' : 'border-line focus:border-gold'}`}
          />
          {pinErr && <p className="text-center text-[13px] text-loss">Неверный PIN</p>}
          <Button full onClick={check}>Открыть</Button>
          <Button variant="quiet" full onClick={() => nav(-1)}>Назад</Button>
        </Card>
      </div>
    )
  }

  if (!p) return <Card><p className="text-[14px] text-muted">Игрок ещё не создан.</p><Button className="mt-3" onClick={() => nav('/')}>На главную</Button></Card>
  const owned = game.buildings.size

  return (
    <div className="stagger space-y-4">
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <Title>Админ-панель</Title>
          <button onClick={() => { sessionStorage.removeItem('dynasty-admin'); nav('/council') }} aria-label="Выйти" className="grid h-10 w-10 place-items-center rounded-full text-muted active:bg-panel"><Icon name="close" /></button>
        </div>
        <p className="mt-1 text-[14px] text-muted">Меняет только данные на этом устройстве. Всё видно сразу: сверху в шапке, на «Сегодня» и в «Империи».</p>
      </div>

      <Card className="space-y-3">
        <Label>Ресурсы · {fmtNum(p.capital)} ₸ · {fmtNum(p.xp)} XP · репутация {p.reputation} · влияние {fmtNum(p.influence)}</Label>
        <div className="flex flex-wrap gap-2">
          {[1000, 10000, -1000].map((v) => <button key={`c${v}`} className={chip} onClick={() => adjustPlayer({ capital: v })}>{v > 0 ? '+' : ''}{fmtNum(v)} ₸</button>)}
          {[100, 1000, -100].map((v) => <button key={`x${v}`} className={chip} onClick={() => adjustPlayer({ xp: v })}>{v > 0 ? '+' : ''}{fmtNum(v)} XP</button>)}
          {[10, -10].map((v) => <button key={`r${v}`} className={chip} onClick={() => adjustPlayer({ reputation: v })}>{v > 0 ? '+' : ''}{v} репутации</button>)}
          <button className={chip} onClick={() => adjustPlayer({ influence: 100 })}>+100 влияния</button>
        </div>
      </Card>

      <Card className="space-y-3">
        <Label>Титул · сейчас «{content.ranks.find((r) => r.n === p.rank)?.title}»</Label>
        <p className="text-[13px] text-muted">Нажми титул: он выставится, и покажется церемония перехода на новый этап. Фон и модели в Империи сменятся.</p>
        <div className="grid grid-cols-1 gap-2">
          {content.ranks.map((r) => (
            <button key={r.n} onClick={() => setRank(r.n, true)} className={`${chip} flex items-center justify-between text-left ${p.rank === r.n ? 'border-gold/70 text-gold-soft' : ''}`}>
              <span>{r.n}. {r.title}</span>
              {p.rank === r.n && <span className="text-[12px] text-muted">сейчас</span>}
            </button>
          ))}
        </div>
        <Button variant="ghost" full onClick={() => previewCeremony(Math.min(p.rank + 1, content.ranks.length))}>Показать церемонию следующего титула (без смены)</Button>
      </Card>

      <Card className="space-y-3">
        <Label>Империя · построено {owned} из {content.empire.buildings.length - 1} покупных</Label>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setAllBuildings(true)}>Открыть все</Button>
          <Button variant="ghost" className="flex-1" onClick={() => setAllBuildings(false)}>Закрыть все</Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <Label>Время суток в Империи · сейчас {TIME_LABELS[timeMode] ?? 'Авто'}</Label>
        <p className="text-[13px] text-muted">«Авто» берёт часы телефона: вечером в окнах загорается свет, ночью светятся светлячки. Остальное — для проверки. Откройте «Империю», чтобы увидеть.</p>
        <div className="grid grid-cols-4 gap-2">
          {(['auto', 'day', 'dusk', 'night'] as const).map((k) => (
            <button key={k} onClick={() => { if (k === 'auto') localStorage.removeItem('dynasty-time'); else localStorage.setItem('dynasty-time', k); setTimeMode(k) }} className={`${chip} px-1 ${timeMode === k ? 'border-gold/70 text-gold-soft' : ''}`}>{TIME_LABELS[k]}</button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3 !border-loss/50">
        <Label>Сброс</Label>
        <p className="text-[13px] leading-relaxed text-muted">Удалит игрока, весь прогресс, постройки, настройки и правки плана с этого устройства. Начнёшь с экрана основания Дома. Отменить нельзя.</p>
        <Button variant="ghost" full onClick={async () => downloadBlob(await exportState())}>Сначала сохранить бэкап</Button>
        <button onClick={() => setConfirm(true)} className="min-h-12 w-full rounded-xl border border-loss/60 text-[15px] font-semibold text-loss active:bg-loss/10">Сбросить всё…</button>
      </Card>

      {confirm && <ConfirmDialog title="Сбросить всю игру?" text="Весь прогресс, Капитал, титулы и постройки будут удалены без возможности вернуть." confirmLabel="Подтвердить сброс" busyLabel="Сбрасываю…" busy={busy} onConfirm={doReset} onCancel={() => setConfirm(false)} />}
    </div>
  )
}
