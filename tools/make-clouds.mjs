// Облака для сцены Империи: Models/clouds-1.png.jpg (лист из 6 облаков на чёрном) и Models/clouds-sea.png.jpg (большая гряда)
// → public/art/clouds/cloud-1..6.webp и sea.webp с прозрачным фоном (альфа берётся из яркости, чёрный фон исчезает).
// Запуск из корня проекта:   node tools/make-clouds.mjs     (sharp уже в devDependencies)
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const OUT = path.resolve('public/art/clouds')
fs.mkdirSync(OUT, { recursive: true })

/** Чёрный фон → прозрачность. Цвет делится на альфу, чтобы края не оставались тёмными. */
async function cutout(input, width, file) {
  const { data, info } = await sharp(input).resize({ width, withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const m = Math.max(data[i], data[i + 1], data[i + 2])
    const a = Math.min(1, Math.max(0, (m - 6) / 120))
    const k = a > 0 ? Math.min(255 / Math.max(m, 1), 1 / Math.max(a, 0.001)) : 0
    out[j] = Math.min(255, data[i] * k); out[j + 1] = Math.min(255, data[i + 1] * k); out[j + 2] = Math.min(255, data[i + 2] * k); out[j + 3] = Math.round(a * 255)
  }
  const img = sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
  const trimmed = await img.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer()
  await sharp(trimmed).webp({ quality: 85, alphaQuality: 90 }).toFile(`${OUT}/${file}`)
  const m = await sharp(`${OUT}/${file}`).metadata()
  console.log(file, m.width + 'x' + m.height, (fs.statSync(`${OUT}/${file}`).size / 1024) | 0, 'КБ')
}

const sheet = 'Models/clouds-1.png.jpg'
const { width: W, height: H } = await sharp(sheet).metadata()
let n = 1
for (let r = 0; r < 2; r++) {
  for (let c = 0; c < 3; c++) {
    const cell = await sharp(sheet).extract({ left: Math.round((c * W) / 3), top: Math.round((r * H) / 2), width: Math.round(W / 3), height: Math.round(H / 2) }).toBuffer()
    await cutout(cell, 600, `cloud-${n++}.webp`)
  }
}
await cutout('Models/clouds-sea.png.jpg', 1400, 'sea.webp')
