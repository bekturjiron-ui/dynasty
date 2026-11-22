// Фоны стадий: Models/stage-N.jpeg (портрет, 7 штук) → public/art/stage-N-p.webp (телефон)
// и stage-N-l.webp (ПК, 1920×1080).
// Широкий вариант: портрет по центру, по бокам его зеркальные копии (стыки зеркальные, поэтому без швов),
// размытые и притемнённые для глубины; края центральной картинки смягчены. Если появятся настоящие
// широкие изображения 16:9, просто положите их как public/art/stage-N-l.webp.
// Запуск из корня проекта:   node tools/make-backgrounds.mjs     (sharp уже в devDependencies)
import sharp from 'sharp'
import path from 'path'

const SRC = path.resolve('Models')
const OUT = path.resolve('public/art')
const W = 1920
const H = 1080
const FEATHER = 90 // ширина смягчения краёв центральной картинки

for (let i = 1; i <= 7; i++) {
  const src = `${SRC}/stage-${i}.jpeg`
  await sharp(src).webp({ quality: 82 }).toFile(`${OUT}/stage-${i}-p.webp`)

  const center = await sharp(src).resize({ height: H }).toBuffer()
  const flipped = await sharp(center).flop().toBuffer()
  const w = (await sharp(center).metadata()).width
  const n = 7 // нечётное число тайлов; центральный индекс 3
  const tiles = Array.from({ length: n }, (_, k) => ({ input: (k - 3) % 2 === 0 ? center : flipped, left: k * w, top: 0 }))
  const strip = await sharp({ create: { width: n * w, height: H, channels: 3, background: '#111114' } }).composite(tiles).png().toBuffer()
  const cx = Math.round((n * w - W) / 2)
  const side = await sharp(strip).extract({ left: cx, top: 0, width: W, height: H }).blur(3).modulate({ brightness: 0.72 }).toBuffer()

  // центральная картинка с плавными краями (маска-градиент по горизонтали)
  const mask = Buffer.from(
    `<svg width="${w}" height="${H}"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0">` +
      `<stop offset="0" stop-color="#000"/><stop offset="${FEATHER / w}" stop-color="#fff"/>` +
      `<stop offset="${1 - FEATHER / w}" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs>` +
      `<rect width="${w}" height="${H}" fill="url(#g)"/></svg>`,
  )
  const soft = await sharp(center).ensureAlpha().composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }]).png().toBuffer()
  await sharp(side).composite([{ input: soft, left: Math.round((W - w) / 2), top: 0 }]).webp({ quality: 80 }).toFile(`${OUT}/stage-${i}-l.webp`)
  console.log('stage', i, 'готов')
}
