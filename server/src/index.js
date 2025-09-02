import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createJobRouter, ensureDataDirs } from './jobs.js'

dotenv.config()

const app = express()
app.use(express.json({ limit: '1mb' }))

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: clientOrigin }))

app.get('/health', (_, res) => res.json({ ok: true }))

app.use('/api', createJobRouter())

const port = Number(process.env.PORT || 3001)
app.listen(port, async () => {
  await ensureDataDirs()
  console.log(`Server running on http://localhost:${port}`)
})

