# Фоны уроков: промпты для генерации

Фон урока и босса — «логово» босса недели: его место и предметы, без самого персонажа.
Компонент: `src/components/LessonBackdrop.tsx`. Пока файла нет, экран выглядит как раньше.

## Файлы
- `public/art/lessons/w{key}-p.webp` — телефон, 720×1440 (1:2), до ~150 КБ.
- `public/art/lessons/w{key}-l.webp` — от 768px, 1920×1080 (16:9), до ~250 КБ. Необязателен: без него на ПК фон не покажется.
- `{key}` — Week.key из content/plan.json (201…212), не номер недели.

## Общий стиль (дописывать в конец каждого промпта)
```
dark fantasy painterly digital illustration, same style as a medieval strategy game, warm candlelight and gold #C9A227 accents against near-black #0E0E10 shadows, muted desaturated palette, soft volumetric light, no people, no characters, no text, no letters, no logos, empty calm dark area in the center and lower half for UI text overlay, strong vignette, low contrast in the middle, vertical 1:2 composition
```
Негатив: `people, faces, text, watermark, letters, numbers in focus, bright colors, busy center, modern objects, UI`

Для `-l` версии: заменить `vertical 1:2 composition` на `wide 16:9 composition, details pushed to left and right edges`.

Совет: прикладывать как референс стиля портрет босса недели (`public/art/bosses/tNN-boss.webp`) и `public/art/stage-3-p.webp`.

## Сцены
| Файл | Неделя / босс | Сцена |
|---|---|---|
| w201 | Фундамент · монах-счетовод | a quiet monastery scriptorium at night, tall shelves of ancient ledgers, an open giant ledger book on a lectern, glowing golden numerals drifting in the air like dust, abacus, quills and inkwells, candlelight |
| w202 | ЦА и оффер · картограф | a cartographer's attic study, walls covered with hand-drawn maps and pinned parchment silhouettes of crowds, a brass compass and green-glowing lantern on a map table, rolled scrolls, string connecting pins |
| w203 | Экономика · ростовщик | a moneylender's counting house vault, brass balance scales on a heavy oak table, stacks and sacks of gold coins, an abacus, receipts on spikes, single hanging lamp, deep shadows |
| w204 | Креативы · маэстро масок | a backstage of an old theatre, rows of theatrical masks on the wall, red velvet curtain edge, costume racks, golden stage light spilling from the side, dust in the air |
| w205 | Кабинет Meta · рыцарь-ключник | an armory gatehouse interior, iron-bound doors with large keyholes, rings of brass keys on hooks, shields with keyhole emblems, torches on stone walls, orderly racks |
| w206 | Pixel и запуск · инспектор с печатями | an inspector's chancery office, desk with stacks of documents and colorful wax seals, a large magnifying glass, a brass stamp, pigeonholes full of letters, green desk lamp |
| w207 | Решения по цифрам · часовщик | a clockmaker's workshop, dozens of pocket watches and wall clocks, floating brass gears, a big hourglass with golden sand on the workbench, tools, warm lamplight |
| w208 | Партнёрская реклама · Дана | an elegant dark salon with an ornate golden mirror, silk ribbons of pale green light floating through the room, a velvet chaise, a small crown on a cushion, candles |
| w209 | Telegram: канал и бот · смотритель | a harbor watchtower interior at dusk, a lantern in the window, coiled ropes, a signal mast, paper airplanes resting on a windowsill, view of the night sea through an arch |
| w210 | 160 знаков, модерация · сова-цензор | an owl's library tower, round window with moonlight, high shelves of scrolls with red wax seals, an inkwell and quill on a reading desk, feathers on the floor |
| w211 | Аналитика · змей-воронка | a dark stone cavern with a spiral funnel-shaped pit, gold coins slowly spilling down into the darkness, cracked golden veins in the rock, a single shaft of light from above |
| w212 | Комплексный запуск · король | a royal throne hall of a small dynasty, banners with golden scales emblem, a closed rulebook on a stand, crimson and gold drapes, long hall fading into shadow, morning light through tall windows |

## Сжатие в webp
Любым конвертером (например, squoosh.app): обрезать до нужного размера, WebP, качество около 70.
