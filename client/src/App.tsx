import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Container, Grid, Paper, Stack, TextField, Typography, LinearProgress, Divider, Alert } from '@mui/material'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'

type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

interface CreateJobResponse { jobId: string }
interface JobStatusResponse { status: JobStatus; progress: number; message?: string }

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export default function App() {
  const [toc, setToc] = useState('Глава 1\n  1.1 Подглава\n  1.2 Подглава\nГлава 2')
  const [prompt, setPrompt] = useState('Ты — исследователь и писатель. Для каждой главы найди релевантные источники, кратко проведи глубокое исследование, затем напиши содержательный текст для книги на русском языке. Используй подзаголовки, списки и примеры. Избегай выдумок. Указывай цитаты без ссылок.')
  const [jobId, setJobId] = useState<string>('')
  const [status, setStatus] = useState<JobStatus>('pending')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<string | undefined>()
  const [markdown, setMarkdown] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pollingRef = useRef<number | null>(null)

  const canStart = useMemo(() => toc.trim().length > 0 && prompt.trim().length > 0 && !isSubmitting, [toc, prompt, isSubmitting])

  useEffect(() => {
    return () => { if (pollingRef.current) window.clearInterval(pollingRef.current) }
  }, [])

  const startJob = async () => {
    try {
      setIsSubmitting(true)
      const resp = await axios.post<CreateJobResponse>(`${SERVER_URL}/api/jobs`, { toc, prompt })
      setJobId(resp.data.jobId)
      setStatus('running')
      startPolling(resp.data.jobId)
    } catch (e: any) {
      setMessage(e?.response?.data?.error || e.message)
      setStatus('failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const startPolling = (id: string) => {
    if (pollingRef.current) window.clearInterval(pollingRef.current)
    pollingRef.current = window.setInterval(async () => {
      try {
        const s = await axios.get<JobStatusResponse>(`${SERVER_URL}/api/jobs/${id}`)
        setStatus(s.data.status)
        setProgress(s.data.progress)
        setMessage(s.data.message)
        if (s.data.status === 'completed') {
          window.clearInterval(pollingRef.current!)
          const md = await axios.get(`${SERVER_URL}/api/jobs/${id}/markdown`)
          setMarkdown(md.data)
        }
      } catch (e: any) {
        setMessage(e?.response?.data?.error || e.message)
      }
    }, 1500)
  }

  const downloadPdf = () => {
    if (!jobId) return
    window.open(`${SERVER_URL}/api/jobs/${jobId}/pdf`, '_blank')
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Создание книги</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={2}>
              <TextField label="Оглавление" value={toc} onChange={e => setToc(e.target.value)} minRows={12} multiline fullWidth />
              <TextField label="Промпт для ресерча и написания" value={prompt} onChange={e => setPrompt(e.target.value)} minRows={8} multiline fullWidth />
              <Stack direction="row" spacing={2}>
                <Button variant="contained" onClick={startJob} disabled={!canStart}>Запустить</Button>
                <Button variant="outlined" onClick={downloadPdf} disabled={status !== 'completed' || !jobId}>Скачать PDF</Button>
              </Stack>
              {status !== 'pending' && (
                <Box>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress variant="determinate" value={progress} />
                    </Box>
                    <Typography variant="body2" sx={{ minWidth: 90, textAlign: 'right' }}>{progress}%</Typography>
                  </Stack>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>Статус: {status}</Typography>
                </Box>
              )}
              {message && <Alert severity={status === 'failed' ? 'error' : 'info'}>{message}</Alert>}
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <Typography variant="h6">Предпросмотр Markdown</Typography>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}

