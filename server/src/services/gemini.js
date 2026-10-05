import { cleanUrl } from '../utils/indicator.js';

export function extractGeminiText(json) {
  if (typeof json?.output_text === 'string') return json.output_text;
  const chunks = [];
  for (const step of json?.steps || []) {
    if (step?.type !== 'model_output') continue;
    for (const block of step?.content || []) {
      if (block?.type === 'text' && typeof block?.text === 'string') chunks.push(block.text);
    }
  }
  return chunks.join('\n');
}

export function extractGeminiCitations(json) {
  const map = new Map();
  for (const step of json?.steps || []) {
    if (step?.type !== 'model_output') continue;
    for (const block of step?.content || []) {
      for (const ann of block?.annotations || []) {
        if (ann?.type !== 'url_citation' || !ann?.url) continue;
        const url = cleanUrl(ann.url);
        if (!url) continue;
        if (!map.has(url)) map.set(url, {
          url,
          title: ann.title ? String(ann.title).slice(0, 300) : null,
        });
      }
    }
  }
  return [...map.values()];
}

export function extractGeminiQueries(json) {
  const out = [];
  for (const step of json?.steps || []) {
    if (step?.type === 'google_search_call') {
      for (const q of step?.arguments?.queries || []) if (q) out.push(String(q));
    }
  }
  return [...new Set(out)];
}

export async function runGeminiGrounded({ input, schema, tools = ['google_search'] }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      input,
      tools: tools.map((type) => ({ type })),
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema,
      },
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = json?.error?.message || json?.message || response.statusText;
    throw new Error(`Gemini: ${detail}`);
  }

  const text = extractGeminiText(json);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Gemini retornou uma resposta que não pôde ser interpretada como JSON estruturado.');
  }

  return {
    data,
    citations: extractGeminiCitations(json),
    queries: extractGeminiQueries(json),
    model: json?.model || model,
    interactionId: json?.id || null,
  };
}
