// Картинки для карты плана: Models/plan/boss-01..12.png и plinth.png на сплошном зелёном фоне (#00FF00)
// → public/art/bosses/tNN-boss.webp (неделя 8: t08-neg.webp) и public/art/plan/plinth.webp с прозрачным фоном.
// Запуск из корня проекта:   node tools/make-plan-art.mjs            (sharp уже в devDependencies)
// Другие папки:              node tools/make-plan-art.mjs <откуда> <куда>   (по умолчанию Models/plan и public/art)
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const IN = path.resolve(process.argv[2] ?? 'Models/plan')
const OUT = path.resolve(process.argv[3] ?? 'public/art')
const BOSS_W = 480
const PLINTH_W = 512

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/** Зелёный фон → прозрачность. Зелёный отсвет на краях гасится, чтобы не оставалось светлой каймы. */
async function cutout(file, width, outFile) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2]
    const other = Math.max(r, b)
    const dom = g - other
    const k = g > 40 ? dom / g : 0
    const alpha = 1 - smooth(0.22, 0.55, k)
    if (dom > 0) g = Math.min(g, other + dom * 0.1)
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = Math.round(alpha * 255)
  }
  const raw = sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
  const trimmed = await raw.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 }).png().toBuffer()
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  await sharp(trimmed).resize({ width, withoutEnlargement: true }).webp({ quality: 86, alphaQuality: 92 }).toFile(outFile)
  const m = await sharp(outFile).metadata()
  console.log(path.relative(process.cwd(), outFile), `${m.width}x${m.height}`, `${(fs.statSync(outFile).size / 1024) | 0} КБ`)
}

const names = []
for (let n = 1; n <= 12; n++) {
  const nn = String(n).padStart(2, '0')
  names.push([`boss-${nn}`, `bosses/t${nn}-${n === 8 ? 'neg' : 'boss'}.webp`, BOSS_W])
}
names.push(['plinth', 'plan/plinth.webp', PLINTH_W])

let done = 0
for (const [src, dst, w] of names) {
  const file = ['.png', '.jpg', '.jpeg', '.webp'].map((e) => path.join(IN, src + e)).find((f) => fs.existsSync(f))
  if (!file) { console.log('нет файла', src); continue }
  await cutout(file, w, path.join(OUT, dst))
  done++
}
console.log(`Готово: ${done} из ${names.length}`)
