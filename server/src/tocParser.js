// Simple TOC parser: determines level by indentation (tabs or spaces)
// Returns flat array of { id, title, level }
import { v4 as uuidv4 } from 'uuid';

export function parseTocToSections(tocText) {
  if (!tocText || typeof tocText !== 'string') return [];
  const lines = tocText.split(/\r?\n/).filter(l => l.trim().length > 0);
  const sections = [];
  for (const rawLine of lines) {
    const match = rawLine.match(/^(\s*)([\-\*\d\.]*)\s*(.*)$/);
    if (!match) continue;
    const indent = match[1] || '';
    const title = (match[3] || '').trim();
    if (!title) continue;
    const spaces = indent.replace(/\t/g, '  ');
    const level = Math.floor(spaces.length / 2) + 1; // every 2 spaces increases level
    sections.push({ id: uuidv4(), title, level });
  }
  return sections;
}

