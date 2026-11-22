// Фоны стадий: Models/stage-N.jpeg (портрет, 7 штук) → public/art/stage-N-p.webp (телефон)
// и stage-N-l.webp (ПК: портрет по центру на размытой заливке по бокам).
// Запуск из корня проекта:   node tools/make-backgrounds.mjs     (sharp уже в devDependencies)
import sharp from 'sharp'
import path from 'path'

const SRC = path.resolve('Models')
const OUT = path.resolve('public/art')

for (let i = 1; i <= 7; i++) {
  const src = `${SRC}/stage-${i}.jpeg`
  await sharp(src).webp({ quality: 82 }).toFile(`${OUT}/stage-${i}-p.webp`)
  const bg = await sharp(src).resize(1920, 1080, { fit: 'cover', position: 'top' }).blur(28).modulate({ brightness: 0.7 }).toBuffer()
  const fg = await sharp(src).resize({ height: 1080 }).toBuffer()
  await sharp(bg).composite([{ input: fg, gravity: 'centre' }]).webp({ quality: 78 }).toFile(`${OUT}/stage-${i}-l.webp`)
  console.log('stage', i, 'готов')
}
