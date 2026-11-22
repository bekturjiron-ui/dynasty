// Сжатие 3D-моделей из Meshy/Tripo для телефона: упрощение до нужного числа треугольников,
// текстуры в WebP нужного размера, meshopt-сжатие. Результат кладётся в public/models.
//
// Зависимости не входят в package.json (нужны только при подготовке моделей). Поставьте во временную папку или временно в проект:
//   npm i -D @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer
// Запуск из корня проекта:   node tools/optimize-models.mjs
// Исходники (.glb) лежат в Models/ (папка не в git, ~300 МБ), готовые — в public/models/.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { weld, simplify, dedup, prune, textureCompress, meshopt } from '@gltf-transform/functions'
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const SRC = path.resolve('Models')
const OUT = path.resolve('public/models')

// src — имя файла в Models/ без .glb; name — имя результата; tris — потолок треугольников; tex — сторона текстуры
const JOBS = [
  { src: 'stage-1-Lavka3D', name: 'lavka', tris: 30000, tex: 1024 },
  { src: 'stage-2-Sklad3D', name: 'sklad', tris: 30000, tex: 1024 },
  { src: 'stage-3-Kontora', name: 'kontora', tris: 30000, tex: 1024 },
  { src: 'stage-4-SaleHouse', name: 'torgovy-dom', tris: 30000, tex: 1024 },
  { src: 'stage-5-Palata', name: 'birzha', tris: 30000, tex: 1024 },
  { src: 'stage-6-bank', name: 'bank', tris: 30000, tex: 1024 },
  { src: 'stage-7-castle', name: 'castle', tris: 30000, tex: 1024 },
  { src: 'island', name: 'island', tris: 20000, tex: 2048 },
  { src: 'tree1', name: 'tree1', tris: 2200, tex: 512 }, // деревья размножаются десятками — делаем совсем лёгкими
  { src: 'tree2', name: 'tree2', tris: 2200, tex: 512 },
]

await MeshoptSimplifier.ready
await MeshoptEncoder.ready
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
fs.mkdirSync(OUT, { recursive: true })

for (const j of JOBS) {
  const file = `${SRC}/${j.src}.glb`
  if (!fs.existsSync(file)) { console.log('пропуск (нет файла):', j.src); continue }
  const doc = await io.read(file)
  let tris = 0
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3
  await doc.transform(weld({ tolerance: 1e-4 }))
  if (tris > j.tris) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: j.tris / tris, error: 0.02 }))
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [j.tex, j.tex], quality: 80 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  await io.write(`${OUT}/${j.name}.glb`, doc)
  console.log(j.name, Math.round(tris), 'треугольников →', (fs.statSync(`${OUT}/${j.name}.glb`).size / 1024) | 0, 'КБ')
}
