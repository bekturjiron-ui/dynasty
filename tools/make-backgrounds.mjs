// Фоны стадий: Models/stage-N.jpeg (портрет, 7 штук) → public/art/stage-N-p.webp (телефон)
// и stage-N-l.webp (ПК, 1920×1080).
// Широкий вариант: портрет увеличивается на всю ширину экрана, берётся полоса вокруг центра сюжета,
// слегка размывается (прячет увеличение) и получает мягкую виньетку. Никаких границ и повторов:
// на ПК фон выглядит как мягкая «живописная» подложка, а не прямоугольник посреди экрана.
// Если появятся настоящие широкие изображения 16:9, положите их как public/art/stage-N-l.webp.
// Запуск из корня проекта:   node tools/make-backgrounds.mjs     (sharp уже в devDependencies)
import sharp from 'sharp'
import path from 'path'

const SRC = path.resolve('Models')
const OUT = path.resolve('public/art')
const W = 1920
const H = 1080
const CENTER_Y = 0.5 // какая часть высоты исходной картинки в центре полосы (0 верх, 1 низ)

for (let i = 1; i <= 7; i++) {
  const src = `${SRC}/stage-${i}.jpeg`
  await sharp(src).webp({ quality: 82 }).toFile(`${OUT}/stage-${i}-p.webp`)

  const up = await sharp(src).resize({ width: W }).toBuffer()
  const upH = (await sharp(up).metadata()).height
  const top = Math.max(0, Math.min(upH - H, Math.round(upH * CENTER_Y - H / 2)))
  const vignette = Buffer.from(
    `<svg width="${W}" height="${H}"><defs><radialGradient id="v" cx="50%" cy="50%" r="75%"><stop offset="58%" stop-color="#000" stop-opacity="0"/>` +
      `<stop offset="100%" stop-color="#05060f" stop-opacity="0.4"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#v)"/></svg>`,
  )
  await sharp(up)
    .extract({ left: 0, top, width: W, height: H })
    .blur(2.2)
    .composite([{ input: vignette }])
    .webp({ quality: 80 })
    .toFile(`${OUT}/stage-${i}-l.webp`)
  console.log('stage', i, 'готов')
}
