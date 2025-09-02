import { Router } from 'express'
import { writeFile, readFile, appendFile, mkdir } from 'fs/promises'
import { createWriteStream, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { mdToPdf } from 'md-to-pdf'
import { OpenAI } from 'openai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.resolve(__dirname, '../data')
const booksDir = path.join(dataDir, 'books')
const statusDir = path.join(dataDir, 'status')

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export function createJobRouter() {
  const router = Router()

  router.post('/jobs', async (req, res) => {
    try {
      const { toc, prompt } = req.body || {}
      if (!toc || !prompt) return res.status(400).json({ error: 'toc and prompt are required' })

      const jobId = uuidv4()
      const bookPath = path.join(booksDir, `${jobId}.md`)
      const statusPath = path.join(statusDir, `${jobId}.json`)

      await writeFile(bookPath, `# Книга\n\n`) // init file
      await writeFile(statusPath, JSON.stringify({ status: 'running', progress: 0, message: 'Начало работы' }))

      // Fire and forget background work
      processJob({ jobId, toc, prompt, bookPath, statusPath }).catch(err => console.error('Job error', err))

      res.json({ jobId })
    } catch (e) {
      res.status(500).json({ error: 'failed to create job' })
    }
  })

  router.get('/jobs/:id', async (req, res) => {
    const jobId = req.params.id
    const statusPath = path.join(statusDir, `${jobId}.json`)
    if (!existsSync(statusPath)) return res.status(404).json({ error: 'job not found' })
    const data = JSON.parse(await readFile(statusPath, 'utf8'))
    res.json(data)
  })

  router.get('/jobs/:id/markdown', async (req, res) => {
    const jobId = req.params.id
    const bookPath = path.join(booksDir, `${jobId}.md`)
    if (!existsSync(bookPath)) return res.status(404).send('not found')
    const md = await readFile(bookPath, 'utf8')
    res.type('text/markdown').send(md)
  })

  router.get('/jobs/:id/pdf', async (req, res) => {
    const jobId = req.params.id
    const bookPath = path.join(booksDir, `${jobId}.md`)
    if (!existsSync(bookPath)) return res.status(404).send('not found')

    try {
      const pdf = await mdToPdf({ path: bookPath }, { launch_options: { args: ['--no-sandbox'] } })
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename=book-${jobId}.pdf`)
      res.send(pdf.content)
    } catch (e) {
      res.status(500).send('failed to render pdf')
    }
  })

  return router
}

export async function ensureDataDirs() {
  await mkdir(dataDir, { recursive: true })
  await mkdir(booksDir, { recursive: true })
  await mkdir(statusDir, { recursive: true })
}

function parseToc(tocText) {
  const lines = tocText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const sections = []
  let current = null
  for (const line of lines) {
    const isSub = /^\d+\.\d+/.test(line) || /^[-*]/.test(line) || line.startsWith('—') || line.startsWith('- ')
    if (!isSub) {
      current = { title: line.replace(/^\d+\.?\s*/, ''), subsections: [] }
      sections.push(current)
    } else if (current) {
      current.subsections.push(line.replace(/^([\d.]+|[-*])\s*/, ''))
    }
  }
  return sections
}

async function processJob({ jobId, toc, prompt, bookPath, statusPath }) {
  const sections = parseToc(toc)
  const total = sections.reduce((acc, s) => acc + 1 + s.subsections.length, 0)
  let done = 0

  const update = async (data) => {
    const pct = Math.min(100, Math.round((done / total) * 100))
    await writeFile(statusPath, JSON.stringify({ status: data.status || 'running', progress: pct, message: data.message || '' }))
  }

  await appendFile(bookPath, `\n## Оглавление\n\n`)
  for (const s of sections) {
    await appendFile(bookPath, `- ${s.title}\n`)
    for (const sub of s.subsections) {
      await appendFile(bookPath, `  - ${sub}\n`)
    }
  }

  for (const section of sections) {
    await appendFile(bookPath, `\n# ${section.title}\n\n`)
    const sectionContent = await generateContent(section.title, prompt)
    await appendFile(bookPath, sectionContent + '\n')
    done += 1
    await update({ message: `Глава: ${section.title}` })

    for (const sub of section.subsections) {
      await appendFile(bookPath, `\n## ${sub}\n\n`)
      const subContent = await generateContent(`${section.title} — ${sub}`, prompt)
      await appendFile(bookPath, subContent + '\n')
      done += 1
      await update({ message: `Подглава: ${sub}` })
    }
  }

  await writeFile(statusPath, JSON.stringify({ status: 'completed', progress: 100, message: 'Готово' }))
}

async function generateContent(topic, basePrompt) {
  try {
    // Using reasoning-capable model name from env or fallback
    const model = process.env.OPENAI_MODEL || 'o4-mini'
    const sys = `${basePrompt}\n\nТема: ${topic}. Структурируй материал. Добавь итоги.`
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: `Напиши раздел книги по теме: ${topic}` }
      ],
      temperature: 0.7
    })
    return completion.choices?.[0]?.message?.content || ''
  } catch (e) {
    return `_(Ошибка генерации контента: ${e?.message || 'unknown'})_\n`
  }
}

