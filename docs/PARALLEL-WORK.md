# Параллельная работа двух ИИ-агентов (Claude Code и Antigravity)

**РЕЖИМ: ветки**  (значение «ветки» или «main-напрямую»; агенты читают эту строку)

Идея: у каждого агента **своя ветка и своя папка**, оба пушат свои ветки на GitHub, в `main` всё попадает через pull request. Деплой на сайт идёт только из `main`, поэтому ничего не ломается посреди работы.

```
origin/main  ← PR ←  claude/work   (папка Dynasty IOS App, работает Claude Code)
             ← PR ←  ag/work       (папка Dynasty-AG, работает Antigravity)
```

## 1. Один раз: вторая папка для Antigravity
Два агента в одной папке мешают друг другу (общие файлы, `node_modules`, ветка). Поэтому вторая рабочая папка делается через `git worktree`: общая история, но отдельные файлы и своя ветка. Выполняйте из основной папки:

```powershell
cd "C:\Users\PC\Desktop\Claude\Dynasty IOS App"
git fetch origin
git worktree add "C:\Users\PC\Desktop\Claude\Dynasty-AG" -b ag/work origin/main
cd "C:\Users\PC\Desktop\Claude\Dynasty-AG"
npm ci
```

Откройте **`Dynasty-AG`** в Antigravity, а основную папку **`Dynasty IOS App`** оставьте для Claude Code. `Models/` (тяжёлые исходники моделей) есть только в основной папке: они нужны лишь при подготовке 3D.

## 2. Каждый день
1. Перед началом работы каждый агент обновляет свою ветку:
   ```powershell
   git fetch origin
   git merge origin/main
   ```
2. Работаем, коммитим часто и мелко. Перед коммитом: `npm run validate` (если правили контент) и `npm run build`.
3. Пушим **свою ветку** (первый раз с `-u`):
   ```powershell
   git push -u origin claude/work      # Claude Code
   git push -u origin ag/work          # Antigravity
   ```
   После push GitHub автоматически прогонит проверку `Check` (validate + build). Зелёная галочка = можно сливать.
4. Сливаете в `main`: на GitHub «Compare & pull request» → «Merge» (лучше «Squash and merge»). Или командой `gh pr create --fill` и `gh pr merge --squash`. Сразу после слияния запустится деплой.
5. После слияния обеим веткам снова `git fetch origin` и `git merge origin/main`, чтобы они не отставали.

## 2а. Автоматический режим для Antigravity (команда `node tools/ship.mjs`)
Antigravity сам подтягивает `main` и сам отправляет работу, без вашего участия, но с ограничением:

| Что изменено | Что делает скрипт |
|---|---|
| только `content/`, `docs/`, `public/art/` и проверка Check зелёная | **сам вливает PR в `main`**, сайт обновляется, ветка подтягивается обратно |
| хоть один файл вне этих папок (`src/`, `package.json`, `.github/`, `scripts/`, `tools/` и т. п.) | открывает PR и **останавливается**: ждёт вашего «влей» (или проверки Claude) |
| конфликт с `main`, красные `validate` или `build` | останавливается, ничего не ломает, пишет причину |

Порядок у Antigravity на каждую задачу: 1) `git fetch origin` и `git merge origin/main`; 2) работа и коммит (в конце сообщения `Агент: Antigravity`); 3) `node tools/ship.mjs`. Посмотреть план без отправки: `node tools/ship.mjs --dry`.
Скрипту нужен GitHub CLI (`gh`, он на этом компьютере уже установлен и вошёл в ваш аккаунт). Зона задаётся в начале `tools/ship.mjs` (константа `ZONE`).
Если `ship.mjs` остановился и ждёт владельца, правки вливаются кнопкой **«Влить Antigravity.bat»** на рабочем столе: она подтягивает `main`, прогоняет `validate` и `build`, показывает список изменений и вливает `ag/work` после подтверждения. Кнопка **«Влить в main.bat»** работает только с `claude/work`.
Для Claude Code этот режим **не** включён: я вливаю в `main` только по вашему «влей».

## 3. Чтобы не было конфликтов
- Условьтесь о зонах. Пример (поправьте под себя):

  | Агент | Что трогает |
  |---|---|
  | Claude Code | `src/` (код, анимации, 3D), `scripts/`, `tools/` |
  | Antigravity | `content/` (уроки, боссы, навыки), `docs/`, картинки в `public/art` |

- Если оба должны править один файл, делайте это по очереди: первый сливает PR, второй обновляется (`git merge origin/main`), решает конфликты и только потом сливает.
- Файлы, где конфликты вероятнее всего: `src/index.css`, `src/screens/Empire.tsx`, `content/skills.json`, `content/empire.json`, `package.json`. Их лучше не править одновременно.
- Если при `git merge origin/main` появился конфликт: откройте помеченные места (`<<<<<<<`), оставьте нужное, затем `npm run build`, `git add` и `git commit`.

## 4. Режим «main-напрямую» (для мелких одиночных правок)
Если параллельной работы нет, можно пушить в `main` как раньше. Тогда перед push всегда `git pull --rebase origin main`, чтобы не затереть чужие коммиты. Пока агенты работают одновременно, этот режим **не** использовать.

## 5. Как отличить, кто что сделал
- Ветка (`claude/…` или `ag/…`) видна в истории слияний.
- В сообщении коммита: Claude добавляет `Co-Authored-By: Claude …`, Antigravity пусть добавляет строку `Агент: Antigravity` в конец сообщения.
- Автор коммитов у обоих один (ваш `git config user.name`), это нормально.

## 6. Если что-то пошло не так
- Случайно пушнули в `main`: ничего страшного, но сообщите второму агенту, он сделает `git merge origin/main`.
- Нужно откатить слитый PR: `git revert <коммит>` в новой ветке и снова PR. Историю не переписывать.
- Удалить вторую папку: `git worktree remove "C:\Users\PC\Desktop\Claude\Dynasty-AG"`.
