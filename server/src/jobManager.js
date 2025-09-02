import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';
import { parseTocToSections } from './tocParser.js';
import { generateSectionContent } from './openaiClient.js';
import { mdToPdf } from 'md-to-pdf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const jobs = new Map();
const concurrency = Number(process.env.CONCURRENCY || 3);
const limiter = pLimit(concurrency);

export function getMarkdownPath(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  return job.markdownPath;
}

export function getPdfPath(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  return job.pdfPath && fs.existsSync(job.pdfPath) ? job.pdfPath : null;
}

export function getJobStatus(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  const { id, sections, completedCount, failedCount, startedCount, total, markdownPath, pdfPath, startedAt, finishedAt } = job;
  return {
    jobId: id,
    total,
    started: startedCount,
    completed: completedCount,
    failed: failedCount,
    readyForDownload: Boolean(pdfPath && fs.existsSync(pdfPath)),
    markdownExists: fs.existsSync(markdownPath),
    startedAt,
    finishedAt,
    sections: sections.map(s => ({ id: s.id, title: s.title, level: s.level, status: s.status, error: s.error || null }))
  };
}

export async function startJob({ tocText, promptTemplate }) {
  const id = uuidv4();
  const markdownPath = path.join(DATA_DIR, `${id}.md`);
  const pdfPath = path.join(DATA_DIR, `${id}.pdf`);
  const sections = parseTocToSections(tocText);

  // Initialize MD file with title page and TOC
  const title = '# Generated Book\n\n';
  const tocLines = sections.map(s => `${'  '.repeat(s.level - 1)}- ${s.title}`).join('\n');
  fs.writeFileSync(markdownPath, `${title}## Оглавление\n\n${tocLines}\n\n---\n\n`);

  const job = {
    id,
    markdownPath,
    pdfPath,
    sections: sections.map(s => ({ ...s, status: 'pending' })),
    total: sections.length,
    startedCount: 0,
    completedCount: 0,
    failedCount: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null
  };
  jobs.set(id, job);

  // Schedule background tasks with concurrency limit
  for (const section of job.sections) {
    limiter(() => runSectionTask(job, section, promptTemplate)).catch(() => {});
  }

  // Also schedule a finisher that waits for all tasks to settle then produce PDF
  (async () => {
    await Promise.allSettled(job.sections.map(s => s._promise).filter(Boolean));
    await tryGeneratePdf(job);
    job.finishedAt = new Date().toISOString();
  })();

  return job;
}

async function runSectionTask(job, section, promptTemplate) {
  section.status = 'running';
  job.startedCount += 1;
  try {
    const content = await generateSectionContent({ title: section.title, level: section.level, promptTemplate });
    appendSectionToMarkdown(job.markdownPath, section, content);
    section.status = 'completed';
    job.completedCount += 1;
  } catch (err) {
    console.error('Section failed', section.title, err);
    section.status = 'failed';
    section.error = String(err.message || err);
    job.failedCount += 1;
  }
}

function appendSectionToMarkdown(markdownPath, section, content) {
  const headingHashes = '#'.repeat(Math.min(6, section.level + 1));
  const block = `\n${headingHashes} ${section.title}\n\n${content.trim()}\n`;
  fs.appendFileSync(markdownPath, block);
}

async function tryGeneratePdf(job) {
  if (job.completedCount + job.failedCount !== job.total) return; // not done yet
  try {
    const result = await mdToPdf({ path: job.markdownPath }, { pdf_options: { format: 'A4', printBackground: true } });
    if (result && result.content) {
      fs.writeFileSync(job.pdfPath, result.content);
    }
  } catch (err) {
    console.error('PDF generation failed', err);
  }
}

