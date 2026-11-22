# «Династия»: передача проекта другому ИИ-агенту (Antigravity и др.)

Сводка того, что сделано, как устроено, какие навыки, инструменты и приёмы использовались, и на какие грабли уже наступили. Читайте вместе с `CLAUDE.md` (правила проекта) и `SPEC.md` (полное ТЗ). Интерфейс и контент **на русском**.

## 1. Что это
Игра-тренажёр навыков Kaspi-менеджера: 24 недели, 7 титулов (Посыльный → Глава Дома), боссы, переговоры, империя построек, соперник «Дом Вернеров». Работает как PWA на iPhone, без сервера, данные только в IndexedDB на устройстве. Сайт на GitHub Pages (репозиторий `bekturjiron-ui/dynasty`, ветка `main`, деплой GitHub Actions `deploy.yml` после каждого push, ~1 мин).

## 2. Стек и команды
React 19 + TypeScript + Vite 8, Tailwind 4 (токены в `@theme` внутри `src/index.css`), Dexie (IndexedDB), vite-plugin-pwa, SheetJS (динамически, только при импорте архива Kaspi), Recharts, **three.js 0.187** (лениво, только «Империя» и церемония 7 титула), zod.

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер (порт 5173) |
| `npm run build` | `tsc --noEmit && vite build`: **обязателен без ошибок перед коммитом** |
| `npm run validate` | проверка всего контента в `content/*.json` по схеме и играбельности (недели, навыки, экономика построек) |
| `npm run icons` | генерация иконок PWA |

Правило проекта: после каждого этапа `npm run build` без ошибок, коммит, краткий отчёт. Коммиты на русском. Пока пользователь не попросит, **на GitHub не пушить**.

## 3. Карта кода
- `src/App.tsx`: маршруты, `Shell` (боковое меню от 768px, нижние вкладки на телефоне, `StageBackdrop`, `ResourceBar`).
- `src/screens/`: `Today`, `Plan` (+`plan/PlanEditor`), `Empire`, `Arsenal` (+`arsenal/SkillCard`, `SkillSheet`), `Council` (+`council/*`), `Lesson`, `Boss`, `Negotiation`, `Admin`.
- `src/game/`: `engine.ts` (награды одной транзакцией, ранги, `weekStatus`), `plan.ts` (правки наставника поверх базового плана), `rival.ts`, `negotiation.ts`, `importKaspi.ts`, `backup.ts`, `skills.ts` (уровни навыков 0–3), `admin.ts` (админка, рестарт, полный сброс), `events.ts` (шина «новый титул»).
- `src/components/`: `ui.tsx` (Button, Card с tone, Bar, Label, Icon (набор SVG), `useCountUp`, `Sparks`), `StageBackdrop`, `ResourceBar`, `RankCeremony`, `KingdomScene` (3D-диорама), `ModelViewer`, `ConfirmDialog`, `Sortable`, `ExerciseView`, `TableView`.
- `src/lib/`: `expr.ts` и `sheet.ts` (свои безопасные парсеры формул, **никакого eval**), `three-loader.ts`, `format.ts`, `dates.ts`.
- `content/`: `plan.json`, `lessons/w01…w24.json`, `bosses.json`, `negotiations.json`, `empire.json`, `ranks.json`, `skills.json`, `products.json`. Схемы zod в `src/content/schema.ts`.

## 4. Контент и ключевые правила
- Весь контент только в `content/*.json`; после правки `npm run validate`. Цифры не хардкодить: товары из `products.json` (p1…pN), комиссия/доставка/налог из Settings (`fee`, `delivery`, `tax`).
- **Week.n** — позиция (меняется), **Week.key** — постоянный ключ (исходный номер; новые недели с 101). Контракты, миссии, навыки (`skills.json`, `empire.json`) ссылаются на **key**. Прогресс никогда не хранить по `n`. Соответствие n→key: 1–4→1–4, 5→25, 6–9→5–8, 10→26, 11–15→9–13, 16–17→15–16, 18→17, 19→18, 20→19, 21–24→21–24.
- Ошибки игрока подавать как «доклад советника» в ₸, без слов «неверно», «ошибка», «плохо».
- Правила Kaspi (вознаграждение за отзыв запрещено, публично отвечать на отзывы нельзя, вложения в заказ запрещены) сверять с guide.kaspi.kz перед написанием уроков.
- 11 навыков в `content/skills.json` покрывают все 24 недели ровно по одному разу (проверяет валидатор). Навыки построек (`empire.json → buildings[].skills`) ссылаются на недели тех же навыков.
- Награды (`completeLesson/Boss/Contract/Negotiation/Mission`) выдаёт `engine.ts` одной транзакцией. Импорт бэкапа проверяет структуру **до** очистки базы.
- Мастер-PIN плана по умолчанию `0000` (Settings.mentorPin). Админ-PIN `000` (`src/game/admin.ts`).

## 5. Дизайн-система
- Тёмная тема, золото. Токены: `--color-ink #111114`, панели `#1c1a1f/#252126`, `--color-gold #d8aa42`, `--color-gold-soft #ecc875`, `--color-parch #f1ebdd`, `--color-muted #b3ad9e`; акценты по типам: рубин (босс), изумруд (контракт), медь (переговоры), синий `--color-xp`, фиолетовый `--color-rep`.
- Шрифты **локально** (офлайн): Inter Variable (текст) и PT Serif (заголовки), `@fontsource`. Основной текст 16px.
- Поверхности: классы `.surface`, `.surface-gold/boss/contract/copper` (полупрозрачное «стекло» + blur), `Card tone=…`. Кнопка золота `.btn-gold`.
- **Mobile-first 390px**, безопасная зона iPhone (`.pt-safe`, `.pb-safe`); шапка ресурсов липкая и имеет собственный safe-area отступ. Всё проверять на 390px и 1280px.
- Анимации только CSS/WebGL, **всегда с `prefers-reduced-motion`**. Появление экранов: `.stagger`, `.animate-rise` (fill-mode `backwards`, не `both`).
- Фон по титулу: `StageBackdrop` показывает `public/art/stage-N-p|l.webp` (N = номер титула 1–7).

## 6. 3D и картинки
**Файлы:** `public/models/` (`lavka, sklad, kontora, torgovy-dom, birzha, bank, castle, island, tree1, tree2` `.glb`, всего ~5,5 МБ, meshopt) и `public/art/` (14 WebP фонов). Исходники в `Models/` (~300 МБ, **не в git**).

**Конвейер** (скрипты в `tools/`):
1. Фон-картинка стадии (нейросеть) → `node tools/make-backgrounds.mjs`.
2. 3D: картинка в Tripo3D или Meshy (image-to-3D) → `.glb` в `Models/` → `node tools/optimize-models.mjs` (gltf-transform: упрощение до ~30 тыс. треугольников у построек, 20 тыс. у острова, 2,2 тыс. у деревьев; текстуры WebP 1024/2048/512; meshopt). Исходные модели были по 1,4–2,2 млн треугольников и 40–60 МБ.
3. Загрузка в игре: `GLTFLoader` + `MeshoptDecoder` (`src/lib/three-loader.ts`), модели кэшируются в PWA runtime-кэше (`vite.config.ts`).

**Промпты (стиль для всех):** `hand-painted stylized fantasy, isolated on a plain light-grey background, soft even lighting, no cast shadows, no ground plane, no text`. Фоны стадий: одна камера и композиция, меняется только застройка (лавка → замок-город). Остров: три плоские террасы, дорога, купол сзади под замок, без построек и воды.

**`KingdomScene`** (диорама «Империи»): остров из `island.glb` (если не загрузился, программный рельеф), постройки ставятся на террасы по долям `LAYOUT` (ширины и длины острова), высота ищется лучом вниз по модели. Состояния: owned (цветная), ready (золотой «призрак» с ценой), capital/rank (прозрачный «призрак»). Покупка: рост с упругим масштабом, пыль, волна, тряска. Эффекты: шейдерное море с пеной (карта расстояния до суши из вершин острова), облака, светлячки, дым, птицы, качание деревьев (`onBeforeCompile` на InstancedMesh), смена времени суток по часам устройства (`localStorage['dynasty-time']`: day/dusk/night, переключатель в админке), вступление камеры, авто-снижение качества при <24 fps. Константы: `ISLAND_LEN 24`, `WATER_Y -2.2`, размеры построек в `Empire.tsx → SIZES`.

**Церемония титула** (`RankCeremony.tsx`): у каждого из 7 грейдов своя сцена (печать, монеты, двери с ключом, договор, знамёна, коронация с 3D-замком), растут тряска, лучи, волны, фейерверк (canvas), вибрация.

## 7. Навыки (skills) агента, которые использовались
Формат SKILL.md (каталог skills.sh). В репозитории: `.agents/skills/` и `.claude/skills/`, версии в `skills-lock.json`. Ставятся командой `npx skills add <владелец/репо@навык> -a <агент> -y`; для Antigravity выберите его агента в списке `-a` и проверьте путь установки по документации (в `omer-metin/skills-for-antigravity` формат сразу под него).

| Навык | Источник | Для чего использовался |
|---|---|---|
| `find-skills` | `vercel-labs/skills` | поиск навыков в реестре (`npx skills find <запрос>`) |
| `frontend-design` | `anthropics/skills` | намеренный визуальный дизайн, типографика, отказ от шаблонных решений |
| `emil-design-eng` | `emilkowalski/skills` | детали интерфейса и микро-анимации (нажатия, переходы) |
| `game-ui-design` | `omer-metin/skills-for-antigravity` | игровой интерфейс, HUD, читаемость, награды |
| `web-pwa-offline-first` | `agents-inc/skills` | офлайн-работа PWA, кэш картинок и моделей |
| `ai-image-generation` | `magentosh/superpowers` | генерация изображений через CLI `belt` (inference.sh) |
| `ai-video-generation` | установлен пользователем глобально (`~/.agents/skills`), в `skills-lock.json` проекта его нет | генерация видео через inference.sh (в итоге не использовался) |

Подходили, но не ставились: `cloudai-x/threejs-skills@threejs-fundamentals|threejs-animation|threejs-interaction` (three.js), `mblode/agent-skills@ui-animation`, `giuseppe-trisciuoglio/developer-kit@tailwind-css-patterns`, `nucliweb/webperf-snippets@webperf-media`.

## 8. Инструменты и сервисы
- **GitHub CLI `gh`** (`C:\Program Files\GitHub CLI\gh.exe`, в PATH оболочки может не быть): статус деплоя `gh run list --repo bekturjiron-ui/dynasty`. Вход выполнен пользователем.
- **`belt`** (inference.sh, `~/.local/bin`): генерация картинок, платная по кредитам; баланс был $0, не использовался. Пополнение и вход делает только пользователь.
- **Tripo3D, Meshy.AI**: 3D по картинке; пользователь делает их сам и кладёт `.glb` в `Models/`.
- **gltf-transform + meshoptimizer + sharp**: сжатие моделей и фонов (`tools/`). `sharp` в devDependencies, остальное ставить временно.
- **ffmpeg-static** (во временную папку): достать кадры из видео пользователя (`-vf fps=1,scale=360:-1`), потом контактные листы через sharp.
- **Встроенный браузер/предпросмотр**: `preview_start` (dev-сервер), окно 390×844 и 1280×800, `javascript_exec`.

## 9. Приёмы проверки
- Тестовый игрок: создать Дом на экране приветствия, дальше менять данные через **админку** (вкладка «Совет» → «Админ-панель», PIN `000`): ресурсы, титул с церемонией, постройки, время суток, полный сброс.
- Таблицы IndexedDB проверять из JS: база `dynasty`, таблицы `player, progress, bosses, contracts, activity, settings, reports, negotiations, buildings, plan, missionResults, imports`.
- Предпросмотр замедляет CSS-анимации: фиксировать кадры через `document.getAnimations()` (`finish()` или `pause()` + `currentTime`), а не ждать.
- Для 3D: считать кадры через `requestAnimationFrame` (в окне без видеокарты ~30 fps), подробные скриншоты сцены ждать ~9–12 с после загрузки.

## 10. Грабли, на которые уже наступили
1. **`text-shadow` + `background-clip: text` + `color: transparent`** рисует тень сквозь буквы и затемняет золотой текст. Тень только через `filter: drop-shadow`.
2. **`fixed`-окна внутри элемента с transform/анимацией** позиционируются относительно него. Анимацию появления делать с `fill-mode: backwards`; окна поверх экрана держать вне контекстов наложения и с `z-index` выше нижней панели (z-40/50).
3. **GLSL `smoothstep(a, b, x)` при `a > b` не определён**: писать `1.0 - smoothstep(small, big, x)`.
4. **Липкая шапка уходит под статус-бар iPhone**: нужен отступ `env(safe-area-inset-top)` у самой шапки.
5. **Шаблонные строки и экранирование при правке файлов из оболочки**: `${…}` и обратные кавычки в `node -e`/`sed` портятся. Для сложных правок использовать инструмент записи файлов или скрипт из файла.
6. **Модели Meshy/Tripo тяжёлые** (миллионы треугольников): без `tools/optimize-models.mjs` на телефоне не заработают; деревья размножать только сильно упрощёнными.
7. **Имена в zod**: `SkillSchema` (тип навыка урока, enum) уже занят; навыки Арсенала это `ArsenalSkillSchema`.
8. **Неразрывные слова в заголовках**: пробел между инлайн-блоками нужен как `\u00a0`, иначе схлопывается.
9. В Windows-оболочке `python` и `ffmpeg` отсутствуют; использовать node-пакеты.

## 11. Что не доделано и идеи
- Модели «по желанию» не получены: мельница (+лопасти), маяк, стена, башня, ворота, мост, причал, бочки, прилавок, телега, корабль. Промпты и план использования в истории; подключать по тому же образцу, что `tree1/tree2` в `KingdomScene.tsx`.
- Звук в церемониях (сейчас только визуал и вибрация).
- Рост острова по титулам (стена и башни на 5–6 стадиях, корабли) ждёт моделей.
- Скорость 3D на реальном iPhone не измерена; адаптивное снижение качества встроено.
- Тексты 11 навыков (`content/skills.json`) написал ИИ, их стоит вычитать.
