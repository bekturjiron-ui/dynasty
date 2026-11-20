# Династия

Игра-тренажёр навыков Kaspi-менеджера. PWA без сервера: всё хранится на телефоне. ТЗ — [SPEC.md](SPEC.md), правила для Claude Code — [CLAUDE.md](CLAUDE.md).

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

## Как заменить демо-товары на товары Novelia

Файл `content/products.json`: у каждого товара `name`, `short` (короткое имя для таблиц), `cost` (закуп за 1 шт), `inbound` (доставка до склада на 1 шт), `price` (цена на Kaspi), `orders` (продаж в месяц). Поставь `"demo": false`, затем `npm run validate`: валидатор пересчитает все ответы уроков и покажет их для вычитки.
