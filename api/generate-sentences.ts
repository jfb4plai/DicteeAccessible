import Anthropic from '@anthropic-ai/sdk';
import {
  buildSystemPrompt,
  buildUserPrompt,
  postProcessSentences,
  SENTENCE_SCHEMA,
  validateGenerateInput,
} from '../src/lib/sentenceGeneration.js';

// Fonction Vercel : propose une phrase par mot. L'enseignant(e) relit et valide chaque phrase côté application.
// Aucun contenu (mots, phrases, contexte) n'est écrit dans les journaux.

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Res = { status: (code: number) => Res; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };

const DAILY_LIMIT = 30;

function parseBody(body: unknown): unknown {
  if (typeof body !== 'string') return body;
  try { return JSON.parse(body); } catch { return null; }
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!supabaseUrl || !anonKey || !apiKey) return res.status(500).json({ error: 'config' });

  // 1. L'appelant doit être une enseignante ou un enseignant connecté(e).
  const header = String(req.headers.authorization ?? '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'auth' });
  const who = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
  if (!who.ok) return res.status(401).json({ error: 'auth' });

  // 2. Entrée contrôlée.
  const input = validateGenerateInput(parseBody(req.body));
  if (!input.ok) return res.status(400).json({ error: 'input', detail: input.error });

  // 3. Plafond quotidien (fonction SQL, comptée avec le jeton de l'enseignant(e)).
  const quota = await fetch(`${supabaseUrl}/rest/v1/rpc/dicta_ai_take`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_max: DAILY_LIMIT }),
  });
  if (!quota.ok) {
    const detail = await quota.text();
    return detail.includes('quota_exceeded')
      ? res.status(429).json({ error: 'quota' })
      : res.status(502).json({ error: 'quota_check' });
  }

  // 4. Appel du modèle, sortie structurée.
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 4096,
      system: buildSystemPrompt(input.value),
      messages: [{ role: 'user', content: buildUserPrompt(input.value.words) }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SENTENCE_SCHEMA } },
    });
    if (message.stop_reason === 'refusal') return res.status(502).json({ error: 'refus' });

    const block = message.content.find(b => b.type === 'text');
    let raw: unknown = null;
    if (block && block.type === 'text') {
      try { raw = JSON.parse(block.text); } catch { raw = null; }
    }
    const { sentences, missing } = postProcessSentences(raw, input.value.words, input.value.level);
    return res.status(200).json({ sentences, missing });
  } catch {
    return res.status(502).json({ error: 'ia' });
  }
}
