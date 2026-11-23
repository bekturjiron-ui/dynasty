# Династия

Игра-тренажёр комплексного таргетинга (Instagram/Meta и Telegram Ads) для рынка Казахстана. PWA без сервера: всё хранится на телефоне. Курс на 12 недель: уроки, боссы недели, переговоры, реальные контракты и недельный отчёт кампании.

Документы: игровая механика — [SPEC.md](SPEC.md) (тема Kaspi в нём устарела), правила проекта — [CLAUDE.md](CLAUDE.md), текущее состояние и хвосты — [NOTES.md](NOTES.md), карта кода — [docs/AI-HANDOFF.md](docs/AI-HANDOFF.md).

## Команды

```powershell
npm install          # один раз
npm run dev          # разработка: http://localhost:5173
npm run validate     # проверить контент: схемы, формулы, ответы
npm run build        # сборка в dist/
```

## Деплой на GitHub Pages (бесплатно)

1. Один раз представься git (имя и почта попадут в историю коммитов на GitHub):
   ```powershell
   git config --global user.name "Твоё имя"
   git config --global user.email "почта@от.github"
   ```
   Если не хочешь светить почту — возьми адрес вида `12345+логин@users.noreply.github.com` в GitHub → Settings → Emails.
2. Сделай первый коммит:
   ```powershell
   git add -A
   git commit -m "Династия: этапы 1–4"
   ```
3. На github.com → **New repository** → имя `dynasty`, **Public** (Pages бесплатно только для публичных репозиториев на бесплатном плане), без README.
4. Свяжи и отправь (подставь свой логин):
   ```powershell
   git remote add origin https://github.com/ЛОГИН/dynasty.git
   git push -u origin main
   ```
5. В репозитории: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
6. Вкладка **Actions** → дождись зелёной галочки «Deploy to GitHub Pages» (1–2 минуты). Адрес: `https://ЛОГИН.github.io/dynasty/`.

Дальше каждый `git push` в `main` сам пересобирает и выкладывает игру.

## Установка на iPhone

1. Открой `https://ЛОГИН.github.io/dynasty/` **в Safari** (не в Telegram и не в Chrome).
2. «Поделиться» → «На экран „Домой“» → «Добавить».
3. Запускай с иконки: игра откроется на весь экран и будет работать без интернета.
4. В «Напоминаниях» поставь ежедневное напоминание со ссылкой на игру — push-уведомлений в v1 нет.

Прогресс живёт только на телефоне. Раз в неделю: «Совет» → «Сохранить бэкап».

## Где лежит контент

Весь контент в папке `content/` (схема — `src/content/schema.ts`):

- `lessons/tNN.json` — уроки недели NN, `plan.json` — недели, контракты и порядок уроков;
- `bosses.json`, `negotiations.json` — боссы и переговоры;
- `empire.json`, `ranks.json`, `skills.json`, `glossary.json` — Империя, титулы, Арсенал, глоссарий.

После любой правки: `npm run validate`. Валидатор проверяет схемы, формулы, ответы и то, что игру можно пройти по плану.

## Как заменить учебные офферы на свои

Файл `content/offers.json`: у каждого оффера `name`, `short` (короткое имя для таблиц), `price` (чек), `margin` (маржа от 0 до 1), `clickToLead` (доля кликов, дающих заявку), `leadToSale` (доля заявок, дающих продажу). В формулах уроков доступны `o1.price`, `margin`, `clickToLead`, `leadToSale` и расчётные `profit`, `maxCac`, `maxCpl`, `maxCpc`. Поставь `"demo": false`, затем `npm run validate`.

## Админ-панель для проверки

Внизу экрана «Совет» ссылка «Админ-панель» (PIN `0000`): выдать ресурсы, сменить титул, пройти все уроки и боссов, сбросить игру. Меняет данные только на этом устройстве.
