// Разовый скрипт версии 0.5: числовые задания в неделях 4, 5, 6, 8, 10 становятся заданиями-таблицами 5×5.
// Задания «выбор» не трогаем. Повторный запуск даёт тот же результат.
import { readFileSync, writeFileSync } from 'node:fs'

function update(path, fn) {
  const raw = readFileSync(path, 'utf8')
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const data = fn(JSON.parse(raw))
  writeFileSync(path, JSON.stringify(data, null, 1).replace(/\n/g, eol) + (raw.endsWith('\n') ? eol : ''))
}

const patches = [
  {
    file: 't04', id: 't04-l6', part: 'guided',
    ex: {
      prompt: 'Два ролика для {{o2.short}}. Посчитай Hook Rate каждого: какая доля показов досмотрена до 3 секунд.',
      inputs: {},
      hints: ['Hook Rate = 3-секундные просмотры / показы', 'Для первого ролика: =C2/B2'],
      sheet: {
        grid: [
          ['Ролик', 'Показы', '3 сек', 'Hook Rate'],
          ['№1', 16000, 4800, null],
          ['№2', 22000, 3300, null],
        ],
        targets: [
          { cell: 'D2', solution: '=C2/B2', label: 'Hook Rate ролика №1' },
          { cell: 'D3', solution: '=C3/B3', label: 'Hook Rate ролика №2' },
        ],
      },
    },
  },
  {
    file: 't05', id: 't05-l7', part: 'solo',
    ex: {
      prompt: 'Студия бровей: прибыль с записи и доля переписок, которые становятся записью. Посчитай потолок цены переписки (B3) и сколько переписка стоила на деле (D5). Укладывается ли реклама в потолок?',
      inputs: {},
      hints: ['Потолок = прибыль с записи × доля переписок, которые стали записью', 'Цена переписки = расход / начатые переписки'],
      sheet: {
        grid: [
          ['Прибыль', '$o4.profit', null, null],
          ['В запись', '25%', null, null],
          ['Потолок', null, null, null],
          ['Расход', 48000, null, null],
          ['Переписки', 30, 'Цена', null],
        ],
        targets: [
          { cell: 'B3', solution: '=B1*B2', label: 'Потолок цены переписки' },
          { cell: 'D5', solution: '=B4/B5', label: 'Фактическая цена переписки' },
        ],
      },
    },
  },
  {
    file: 't06', id: 't06-l4', part: 'solo',
    ex: {
      prompt: 'Две лид-формы с одинаковым расходом: простая и с вопросом. «Кач.» — заявки, которые дошли до разговора. Посчитай в столбце E цену качественной заявки для каждой формы: какая выгоднее?',
      inputs: {},
      hints: ['Цена качественной заявки = расход / качественные заявки', 'Для простой формы: =B2/D2'],
      sheet: {
        grid: [
          ['Форма', 'Расход', 'Заявки', 'Кач.', 'Цена'],
          ['Простая', 54000, 60, 18, null],
          ['С вопр.', 54000, 35, 25, null],
        ],
        targets: [
          { cell: 'E2', solution: '=B2/D2', label: 'Цена качественной: простая форма' },
          { cell: 'E3', solution: '=B3/D3', label: 'Цена качественной: форма с вопросом' },
        ],
      },
    },
  },
  {
    file: 't08', id: 't08-l2', part: 'guided',
    ex: {
      prompt: 'Бюджет растёт шагами по +20% раз в несколько дней. Посчитай бюджет на шагах 2–4. Формулу из B3 можно протянуть вниз.',
      inputs: {},
      hints: ['Каждый шаг: предыдущий бюджет × 1,2', 'В B3: =B2*1,2'],
      sheet: {
        grid: [
          ['Шаг', 'Бюджет в день'],
          [1, 12000],
          [2, null],
          [3, null],
          [4, null],
        ],
        targets: [
          { cell: 'B3', solution: '=B2*1.2', label: 'Бюджет на шаге 2' },
          { cell: 'B4', solution: '=B3*1.2', label: 'Бюджет на шаге 3' },
          { cell: 'B5', solution: '=B4*1.2', label: 'Бюджет на шаге 4' },
        ],
      },
    },
  },
  {
    file: 't10', id: 't10-l3', part: 'guided',
    ex: {
      prompt: 'Две кампании в Telegram Ads. Посчитай предельный CPM для каждой: дороже ставить нельзя, иначе подписчик выйдет дороже цели.',
      inputs: {},
      hints: ['Предельный CPM = цель за подписчика × конверсия показа в подписку × 1000', 'Для первой: =B2*C2*1000'],
      sheet: {
        grid: [
          ['Кампания', 'Цель, ₸', 'Конверсия', 'CPM макс.'],
          ['Канал', 400, '0,3%', null],
          ['Бот', 600, '0,15%', null],
        ],
        targets: [
          { cell: 'D2', solution: '=B2*C2*1000', label: 'Предельный CPM: канал' },
          { cell: 'D3', solution: '=B3*C3*1000', label: 'Предельный CPM: бот' },
        ],
      },
    },
  },
]

// Мысль для таблицы t06-l4 должна прозвучать в демо до задания
const T06_STEP = 'Формы сравнивай не по цене заявки, а по цене качественной: расход / заявки, которые дошли до разговора. Форма с вопросами даёт меньше заявок, но качественная часто выходит дешевле.'
update('content/lessons/t06.json', (lessons) => {
  const l = lessons.find((x) => x.id === 't06-l4')
  if (!l.demo.some((d) => d.text === T06_STEP)) l.demo.splice(2, 0, { text: T06_STEP })
  return lessons
})

for (const p of patches) {
  update(`content/lessons/${p.file}.json`, (lessons) => {
    const l = lessons.find((x) => x.id === p.id)
    if (!l) throw new Error(`Нет урока ${p.id}`)
    l[p.part] = p.ex
    return lessons
  })
  console.log(`${p.id}.${p.part} → таблица`)
}
