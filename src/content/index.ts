import { parseContent, type Content } from './schema'
import plan from '../../content/plan.json'
import bosses from '../../content/bosses.json'
import negotiations from '../../content/negotiations.json'
import empire from '../../content/empire.json'
import ranks from '../../content/ranks.json'
import offers from '../../content/offers.json'
import skills from '../../content/skills.json'
import glossary from '../../content/glossary.json'

const lessonFiles = import.meta.glob('../../content/lessons/*.json', { eager: true, import: 'default' })

let content: Content
let contentError: string | null = null
try {
  content = parseContent({ lessonFiles, bosses, negotiations, empire, plan, ranks, offers, skills, glossary })
} catch (e) {
  contentError = e instanceof Error ? e.message : String(e)
  content = { lessons: {}, bosses: {}, negotiations: {}, empire: { rival: { name: '', motto: '', news: [] }, buildings: [] }, missions: [], weeks: [], ranks: [], offers: [], skills: [], glossary: [] }
}

export { content, contentError }
