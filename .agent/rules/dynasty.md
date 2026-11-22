# Правила проекта «Династия» (постоянные)

Прочитайте перед началом работы: `AGENTS.md`, `CLAUDE.md`, `docs/AI-HANDOFF.md`, `docs/PARALLEL-WORK.md`.

- Интерфейс и контент на русском. Стиль: тёмная тема, золото. Mobile-first, проверять на ширине 390px.
- Контент только в `content/*.json`; после правок `npm run validate`. Цифры из контента не хардкодить.
- Формулы только через `src/lib/expr.ts` и `src/lib/sheet.ts`, никогда `eval` или `new Function`.
- Перед коммитом `npm run build` без ошибок.
- **Git:** работайте в своей ветке `ag/work` (своя папка `Dynasty-AG`), пушьте её на GitHub, в `main` только через pull request. Не пушьте в `main` напрямую. Перед началом: `git fetch origin` и `git merge origin/main`.
- Не добавляйте в git папку `Models/` и данные из `data/`.
- Все анимации учитывают `prefers-reduced-motion`.
- Если не уверены, спросите пользователя, а не меняйте общие файлы (`src/index.css`, `content/skills.json`, `content/empire.json`, `package.json`).
