# Картинки для карты плана: что и как генерировать

Карта плана (`src/screens/plan/PlanMap.tsx`) показывает на каждом пункте босса недели. Пока картинок нет, стоят тёмные силуэты и нарисованное основание. Когда картинки готовы:

1. Положить PNG в `Models/plan/` (папка вне git): `boss-01.png` … `boss-12.png` и `plinth.png`.
2. Запустить `node tools/make-plan-art.mjs`: скрипт вырежет зелёный фон и положит WebP в `public/art/bosses/` (`tNN-boss.webp`, неделя 8 это `t08-neg.webp`) и `public/art/plan/plinth.webp`.
3. `npm run build`, проверить карту, закоммитить. Кэш картинок в `vite.config.ts` рассчитан на 80 файлов.

Всего 13 картинок. Тёмное состояние босса делает код фильтром, отдельные картинки «в тени» не нужны.

## Общий стиль (в начало каждого промпта)
```
Hand-painted dark-fantasy illustration, rich painterly brushwork, warm candlelit palette
with deep charcoal and aged gold (#C9A227) accents, soft rim light, medieval merchant-guild
world, consistent with a moody game UI. Single character, full body, centered, front-facing,
slight three-quarter angle, standing on a small invisible ground point, no ground shadow,
no scenery, no text, no letters, no logos, no watermark.
Background: perfectly flat pure bright green (#00FF00), no gradient, no green on the
character. Portrait orientation 4:5, 1024x1280.
```
Генерировать всех в одном чате, прикладывая первого утверждённого босса как образец стиля. Надписей на картинках быть не должно.

## Основание (1024×1024)
```
[общий стиль] An isometric round stone pedestal for a game map node: weathered grey
stone disc with a thin engraved gold rim and a subtle glowing rune ring on top, empty top
surface, seen from a slight 3/4 top-down angle, centered, square 1:1, 1024x1024.
Flat pure bright green (#00FF00) background.
```

## Боссы (к общему стилю добавить строку)
1. **Хранитель цифр:** a stern keeper of numbers, an old scribe in ink-stained robes holding a huge open ledger, spectacles, quill behind the ear, floating small golden digits around him.
2. **Картограф теней:** a cartographer in a long coat made of unrolled maps, holding a brass compass and a lantern, face half hidden by a wide hat, silhouettes of crowds drawn on the maps.
3. **Скряга-счетовод:** a miserly accountant, thin and hunched, balancing a pair of heavy golden scales on one hand and an abacus on the other, coins stacked at his belt, suspicious narrow eyes.
4. **Мастер масок:** a theatrical master of masks in a velvet cloak, wearing three different masks stacked on a stand held in his hand and one on his face, theatrical gold embroidery.
5. **Страж ключей:** a broad armored gatekeeper with a giant ring of ornate keys hanging from his belt, a heavy iron shield engraved with a keyhole, calm and unmovable.
6. **Инспектор печатей:** a precise inspector with a large magnifying glass and an oversized rubber seal stamp in the other hand, a coat covered with wax seals, one raised eyebrow.
7. **Часовщик судьбы:** an eccentric clockmaker with brass gear goggles, a tall hourglass in one hand, clock gears floating around, coat with pockets full of tiny clocks.
8. **Дана (неделя 8, партнёр по переговорам, не злая):** a charismatic young beauty influencer queen in an elegant gown, holding a ring light like a crown and a smartphone made as a gilded hand mirror, ribbons of light around her, confident warm smile.
9. **Привратник башни:** a lanky doorman of a tall tower in a ceremonial coat, holding a lantern and a thin staff with a small paper plane at its top, polite but unyielding stance.
10. **Цензор-сова:** a large owl-headed censor in a judge's robe, holding a red-ink quill and a long scroll, tiny spectacles, feathers ruffled with stern authority.
11. **Змей воронки:** a coiled serpent shaped like a funnel, scales of dull bronze with golden cracks, its body narrowing downward, eyes glowing amber, small coins leaking from the cracks.
12. **Владыка рынка (финальный):** a majestic final boss, a market sovereign in a heavy golden-black armor-robe with a tall crown of merchant sigils, a great ledger-scepter, a cape that billows, larger and more imposing than the others.

Если генератор не держит зелёный фон, допустима сплошная чёрная или белая подложка, но тогда скрипт `tools/make-plan-art.mjs` придётся подстроить.
