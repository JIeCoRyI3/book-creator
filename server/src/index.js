import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { startJob, getJobStatus, getMarkdownPath, getPdfPath } from './jobManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Start job
app.post('/api/start', async (req, res) => {
  try {
    const { tocText, promptTemplate } = req.body || {};
    if (!tocText || !promptTemplate) {
      return res.status(400).json({ error: 'tocText and promptTemplate are required' });
    }
    const job = await startJob({ tocText, promptTemplate });
    res.json({ jobId: job.id });
  } catch (err) {
    console.error('Failed to start job', err);
    res.status(500).json({ error: 'Failed to start job' });
  }
});

// Job status
app.get('/api/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const status = getJobStatus(jobId);
  if (!status) return res.status(404).json({ error: 'Job not found' });
  res.json(status);
});

// Get markdown
app.get('/api/markdown/:jobId', (req, res) => {
  const { jobId } = req.params;
  const mdPath = getMarkdownPath(jobId);
  if (!mdPath || !fs.existsSync(mdPath)) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  fs.createReadStream(mdPath).pipe(res);
});

// Download PDF
app.get('/api/pdf/:jobId', (req, res) => {
  const { jobId } = req.params;
  const pdfPath = getPdfPath(jobId);
  if (!pdfPath || !fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF not ready' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=book-${jobId}.pdf`);
  fs.createReadStream(pdfPath).pipe(res);
});

// Serve static (optional for deployments)
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

