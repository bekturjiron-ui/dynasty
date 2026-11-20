// Генерирует PNG-иконки из SVG: npm run icons
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0E0E10"/>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)">
    <circle cx="256" cy="256" r="196" fill="none" stroke="#C9A227" stroke-width="10"/>
    <circle cx="256" cy="256" r="176" fill="none" stroke="#C9A227" stroke-width="3" opacity="0.6"/>
    <path d="M150 214 L186 150 L221 196 L256 132 L291 196 L326 150 L362 214 Z" fill="#C9A227"/>
    <rect x="150" y="222" width="212" height="14" fill="#C9A227"/>
    <text x="256" y="378" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="150" font-weight="700" fill="#C9A227">Д</text>
  </g>
</svg>`

writeFileSync('public/icons/favicon.svg', svg(0))
const jobs = [
  ['public/icons/apple-touch-icon.png', 180, 0],
  ['public/icons/icon-192.png', 192, 0],
  ['public/icons/icon-512.png', 512, 0],
  ['public/icons/icon-512-maskable.png', 512, 0.2],
]
for (const [file, size, pad] of jobs) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(file)
}
console.log('icons ok')
