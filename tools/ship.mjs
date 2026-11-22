// Отправка работы агента в main одной командой, с проверками. Для Antigravity (зона: content/, docs/, public/art/).
//
//   node tools/ship.mjs            подтянуть main, проверить, запушить ветку, открыть PR и, если всё в зоне и проверка зелёная, влить
//   node tools/ship.mjs --dry      только показать, что было бы сделано (ничего не отправляет)
//
// Правила:
//  - работает только из рабочей ветки (не main);
//  - сначала сливает origin/main в ветку; при конфликте останавливается и ничего не ломает;
//  - если изменены файлы ВНЕ зоны, PR открывается, но НЕ вливается: ждёт владельца («влей»);
//  - вливает обычным merge-коммитом только после зелёной проверки Check.
import { spawnSync } from 'child_process'

const dry = process.argv.includes('--dry')
const ZONE = ['content/', 'docs/', 'public/art/']
const say = (...a) => console.log(...a)
const die = (msg, code = 1) => { console.error('СТОП: ' + msg); process.exit(code) }

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' && cmd === 'npm', ...opts })
  return r
}
const git = (...a) => {
  const r = run('git', a)
  if (r.status !== 0) die(`git ${a.join(' ')}\n${r.stderr || r.stdout}`)
  return (r.stdout || '').trim()
}

// gh может не быть в PATH у среды Antigravity: пробуем обычный путь установки
let GH = 'gh'
if (run('gh', ['--version']).status !== 0) {
  const full = 'C:\\Program Files\\GitHub CLI\\gh.exe'
  if (run(full, ['--version']).status === 0) GH = full
  else die('не найден GitHub CLI (gh). Откройте PR вручную по ссылке из вывода git push и скажите владельцу «влей».')
}
const gh = (...a) => run(GH, a)

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
if (branch === 'main' || branch === 'HEAD') die('вы на ' + branch + '. Работайте в своей ветке (например ag/work).')
if (git('status', '--porcelain', '--untracked-files=no')) die('есть незакоммиченные изменения. Сначала git add и git commit.')

say('1/6 подтягиваю main…')
git('fetch', 'origin')
const m = run('git', ['merge', 'origin/main', '--no-edit'])
if (m.status !== 0) {
  run('git', ['merge', '--abort'])
  die('конфликт при слиянии с main. Ничего не сломано. Скажите владельцу, какие файлы конфликтуют:\n' + (m.stdout || '') + (m.stderr || ''), 2)
}

const changed = git('diff', '--name-only', 'origin/main...HEAD').split('\n').filter(Boolean)
if (!changed.length) { say('Нет изменений относительно main: отправлять нечего.'); process.exit(0) }
const outside = changed.filter((f) => !ZONE.some((z) => f.startsWith(z)))
say(`2/6 изменено файлов: ${changed.length}. Вне зоны: ${outside.length ? outside.join(', ') : 'нет'}`)

say('3/6 проверки (validate + build)…')
if (changed.some((f) => f.startsWith('content/'))) {
  const v = run('npm', ['run', 'validate'])
  if (v.status !== 0) die('validate не прошёл:\n' + (v.stdout || '') + (v.stderr || ''))
}
const b = run('npm', ['run', 'build'])
if (b.status !== 0) die('build не прошёл:\n' + (b.stdout || '').slice(-1500) + (b.stderr || ''))

if (dry) {
  say(`\n[dry] Дальше было бы: push ветки ${branch}, PR в main, ${outside.length ? 'остановка (файлы вне зоны, ждём владельца)' : 'ожидание Check и слияние'}.`)
  process.exit(0)
}

say('4/6 отправляю ветку…')
git('push', '-u', 'origin', branch)

say('5/6 pull request…')
let pr = JSON.parse(gh('pr', 'list', '--head', branch, '--state', 'open', '--json', 'number').stdout || '[]')[0]
if (!pr) {
  const title = git('log', '-1', '--format=%s')
  const body = `Автоматический PR (tools/ship.mjs).\n\nИзменённые файлы:\n${changed.map((f) => '- ' + f).join('\n')}\n\nАгент: Antigravity`
  const c = gh('pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body', body)
  if (c.status !== 0) die('не удалось создать PR:\n' + (c.stderr || c.stdout))
  pr = JSON.parse(gh('pr', 'list', '--head', branch, '--state', 'open', '--json', 'number').stdout)[0]
}
say('PR #' + pr.number)

if (outside.length) {
  say(`\nОстановился: затронуты файлы вне вашей зоны (${outside.join(', ')}). PR открыт, ждёт владельца: скажите ему «влей».`)
  process.exit(0)
}

say('6/6 жду проверку Check и вливаю…')
// после создания PR проверка появляется не сразу
for (let i = 0; i < 8; i++) { if (gh('pr', 'checks', String(pr.number)).stdout.trim()) break; spawnSync('node', ['-e', 'setTimeout(()=>{},5000)']) }
const w = gh('pr', 'checks', String(pr.number), '--watch', '--fail-fast')
if (w.status !== 0) die('проверка Check не зелёная. Не вливаю. Исправьте и запустите снова.\n' + (w.stdout || '') + (w.stderr || ''))
const mg = gh('pr', 'merge', String(pr.number), '--merge')
if (mg.status !== 0) die('не удалось влить:\n' + (mg.stderr || mg.stdout))
git('fetch', 'origin')
git('merge', 'origin/main', '--no-edit')
say(`\nГотово: PR #${pr.number} влит в main, сайт обновится после деплоя. Ветка ${branch} синхронизирована с main.`)
