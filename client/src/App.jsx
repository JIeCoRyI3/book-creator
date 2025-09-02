import { useCallback, useEffect, useMemo, useState } from 'react'
import { Container, Box, Typography, TextField, Button, Paper, LinearProgress, List, ListItem, ListItemText, Divider, Stack } from '@mui/material'
import './App.css'

const API_BASE = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'

function App() {
  const [tocText, setTocText] = useState('Глава 1\n  Подглава 1.1\n  Подглава 1.2\nГлава 2')
  const [promptTemplate, setPromptTemplate] = useState('Секция: {{section_title}} (уровень {{section_level}}). Напиши подробный текст в формате Markdown с подзаголовками и списками.')
  const [jobId, setJobId] = useState('')
  const [status, setStatus] = useState(null)
  const [markdown, setMarkdown] = useState('')
  const isRunning = useMemo(() => Boolean(jobId) && status && !status.readyForDownload, [jobId, status])

  const startJob = useCallback(async () => {
    setJobId('')
    setStatus(null)
    setMarkdown('')
    const res = await fetch(`${API_BASE}/api/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tocText, promptTemplate })
    })
    if (!res.ok) {
      alert('Не удалось запустить задачу')
      return
    }
    const data = await res.json()
    setJobId(data.jobId)
  }, [tocText, promptTemplate])

  useEffect(() => {
    if (!jobId) return
    let mounted = true
    const interval = setInterval(async () => {
      const sRes = await fetch(`${API_BASE}/api/status/${jobId}`)
      if (sRes.ok) {
        const s = await sRes.json()
        if (!mounted) return
        setStatus(s)
      }
      const mRes = await fetch(`${API_BASE}/api/markdown/${jobId}`)
      if (mRes.ok) {
        const text = await mRes.text()
        if (!mounted) return
        setMarkdown(text)
      }
    }, 1500)
    return () => { mounted = false; clearInterval(interval) }
  }, [jobId])

  const downloadPdf = useCallback(() => {
    if (!jobId) return
    window.open(`${API_BASE}/api/pdf/${jobId}`, '_blank')
  }, [jobId])

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Создание книги</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
        <Paper sx={{ p: 2, flex: 1, minWidth: 360 }}>
          <Typography variant="h6">Оглавление</Typography>
          <TextField
            value={tocText}
            onChange={(e) => setTocText(e.target.value)}
            placeholder="Вставьте оглавление с отступами для уровней"
            fullWidth
            multiline
            minRows={10}
            sx={{ mt: 1 }}
          />
          <Typography variant="h6" sx={{ mt: 2 }}>Промпт</Typography>
          <TextField
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            placeholder="Шаблон промпта. Доступны {{section_title}}, {{section_level}}"
            fullWidth
            multiline
            minRows={6}
            sx={{ mt: 1 }}
          />
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button variant="contained" onClick={startJob} disabled={isRunning}>Запустить</Button>
            <Button variant="outlined" onClick={downloadPdf} disabled={!status?.readyForDownload}>Скачать PDF</Button>
          </Stack>
          {isRunning && <Box sx={{ mt: 2 }}><LinearProgress /></Box>}
          {status && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1">Прогресс: {status.completed}/{status.total} (ошибок: {status.failed})</Typography>
              <Paper variant="outlined" sx={{ maxHeight: 240, overflow: 'auto', mt: 1 }}>
                <List dense>
                  {status.sections?.map(sec => (
                    <>
                      <ListItem key={sec.id}>
                        <ListItemText primary={`${'  '.repeat(sec.level - 1)}${sec.title}`} secondary={sec.status + (sec.error ? `: ${sec.error}` : '')} />
                      </ListItem>
                      <Divider />
                    </>
                  ))}
                </List>
              </Paper>
            </Box>
          )}
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="h6">Markdown</Typography>
          <TextField value={markdown} minRows={22} multiline fullWidth sx={{ mt: 1 }} />
        </Paper>
      </Stack>
    </Container>
  )
}

export default App
