// Добавляет урок из JSON-файла в content/lessons/tNN.json и в неделю плана (по Week.key).
// Запуск: node tools/add-lesson.mjs tools/lessons/t11-l7.json 211
// Формат файлов сохраняется (отступ 1 пробел, переводы строк как в файле). Повторный запуск заменяет урок, а не дублирует.
import { readFileSync, writeFileSync } from 'node:fs'

const [, , src, keyArg] = process.argv
if (!src || !keyArg) throw new Error('Нужно: node tools/add-lesson.mjs <урок.json> <key недели>')
const lesson = JSON.parse(readFileSync(src, 'utf8'))
const weekKey = Number(keyArg)

function update(path, fn) {
  const raw = readFileSync(path, 'utf8')
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const data = fn(JSON.parse(raw))
  writeFileSync(path, JSON.stringify(data, null, 1).replace(/\n/g, eol) + (raw.endsWith('\n') ? eol : ''))
}

update(`content/lessons/${lesson.id.slice(0, 3)}.json`, (lessons) => {
  const i = lessons.findIndex((l) => l.id === lesson.id)
  if (i >= 0) lessons[i] = lesson
  else lessons.push(lesson)
  return lessons
})

update('content/plan.json', (plan) => {
  const w = plan.find((x) => x.key === weekKey)
  if (!w) throw new Error(`Нет недели с key ${weekKey}`)
  if (!w.lessonIds.includes(lesson.id)) w.lessonIds.push(lesson.id)
  console.log(`${lesson.id} в неделе ${weekKey}; уроков в неделе: ${w.lessonIds.length}`)
  return plan
})
