import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn('OPENAI_API_KEY is not set. Please add it to server/.env');
}

const client = new OpenAI({ apiKey });

const defaultModel = process.env.OPENAI_MODEL || 'o4-mini';

export async function generateSectionContent({ title, level, promptTemplate }) {
  const prompt = buildPrompt({ title, level, promptTemplate });
  const model = defaultModel;
  try {
    const response = await client.responses.create({
      model,
      input: prompt,
      temperature: 0.7,
    });
    const text = response.output_text || extractText(response);
    if (!text || !text.trim()) throw new Error('Empty response from model');
    return text.trim();
  } catch (err) {
    // fallback to a widely available model if the chosen model fails
    const fallback = 'gpt-4o-mini';
    if (model !== fallback) {
      const response = await client.responses.create({ model: fallback, input: prompt, temperature: 0.7 });
      const text = response.output_text || extractText(response);
      if (!text || !text.trim()) throw new Error('Empty response from fallback model');
      return text.trim();
    }
    throw err;
  }
}

function buildPrompt({ title, level, promptTemplate }) {
  // Replace placeholders in template
  const template = promptTemplate || '';
  const filled = template
    .replaceAll('{{section_title}}', title)
    .replaceAll('{{section_level}}', String(level));
  // Add minimal guardrails
  return `You are an expert book-writing research assistant.
Write high-quality, well-structured content for a book section.
Constraints:
- Language: match the user's language in the prompt (likely Russian)
- Format: return Markdown only, no front matter
- Structure: use paragraphs, lists, code blocks where relevant
- Add citations or links only when confidently known (no fabrications)

User instructions:\n${filled}`;
}

function extractText(response) {
  try {
    if (response?.output?.length) {
      return response.output.map(p => p?.content?.map(c => c?.text || '').join('')).join('');
    }
  } catch (_) {
    // ignore
  }
  return '';
}

