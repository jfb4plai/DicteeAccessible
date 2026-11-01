import { audioHash } from '../src/lib/audioHash.js';
import { toBelgianSpeech } from '../src/lib/belgianSpeech.js';

// Fonction Vercel : audio d'un mot ou d'une phrase d'une dictée publiée, par une voix belge (ElevenLabs).
// Le texte lu vient toujours de la base ; l'URL ne porte que des identifiants. Aucune clé ni aucun texte dans les journaux.

type Query = Record<string, string | string[] | undefined>;
type Req = { method?: string; query?: Query };
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  send: (body: Buffer) => void;
  setHeader: (name: string, value: string) => void;
};

// Formes canoniques seulement (code en majuscules, id et empreinte en minuscules, aucun paramètre en plus) :
// sinon une même demande aurait plusieurs URL, donc autant d'entrées de cache et d'appels payants.
const SESSION = /^[A-Z0-9]{4,20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{16}$/;
const PARAMS = ['session', 'kind', 'id', 'h'];
const ONE_YEAR = 31536000;
const DAILY_LIMIT_PER_SESSION = 600; // synthèses (ratés de cache) par dictée et par jour

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });

  const session = first(req.query?.session);
  const kind = first(req.query?.kind);
  const id = first(req.query?.id);
  const hash = first(req.query?.h);
  const extra = Object.keys(req.query ?? {}).some(k => !PARAMS.includes(k));
  if (extra || !SESSION.test(session) || (kind !== 'word' && kind !== 'sentence') || !UUID.test(id) || !HASH.test(hash)) {
    return res.status(400).json({ error: 'input' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!supabaseUrl || !anonKey || !apiKey) return res.status(500).json({ error: 'config' });

  // 1. Le texte et la voix viennent de la base, pour une dictée publiée seulement.
  let text: unknown;
  let voice: unknown;
  try {
    const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/dicta_audio_text`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_access_code: session, p_kind: kind, p_id: id }),
    });
    if (!rpc.ok) return res.status(404).json({ error: 'introuvable' });
    ({ text, voice } = await rpc.json());
  } catch {
    return res.status(502).json({ error: 'base' });
  }
  if (typeof text !== 'string' || !text) return res.status(404).json({ error: 'introuvable' });

  // 2. Voix de l'appareil : aucun audio en ligne.
  if (voice === 'device') return res.status(404).json({ error: 'voix' });

  // 3. L'empreinte porte sur la voix et le texte converti : une voix ou un texte modifié change l'URL,
  //    jamais l'audio d'une ancienne URL.
  if (typeof voice !== 'string' || (await audioHash(voice, text)) !== hash) return res.status(409).json({ error: 'texte' });
  const voiceId = voice === 'jef' ? process.env.ELEVENLABS_VOICE_JEF : voice === 'adrien' ? process.env.ELEVENLABS_VOICE_ADRIEN : undefined;
  if (!voiceId) return res.status(500).json({ error: 'config' });

  // 4. Plafond par dictée et par jour : une synthèse payante n'a lieu que sous ce plafond.
  try {
    const take = await fetch(`${supabaseUrl}/rest/v1/rpc/dicta_audio_take`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_access_code: session, p_max: DAILY_LIMIT_PER_SESSION }),
    });
    if (!take.ok) {
      const detail = await take.text();
      return detail.includes('quota_exceeded') ? res.status(429).json({ error: 'quota' }) : res.status(502).json({ error: 'quota_check' });
    }
  } catch {
    return res.status(502).json({ error: 'quota_check' });
  }

  // 5. Synthèse : nombres et lexique belges appliqués au texte envoyé, pas au texte affiché.
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: toBelgianSpeech(text), model_id: 'eleven_multilingual_v2', language_code: 'fr' }),
    });
    if (!r.ok) return res.status(502).json({ error: 'audio' });
    const audio = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, s-maxage=${ONE_YEAR}, immutable`);
    return res.status(200).send(audio);
  } catch {
    return res.status(502).json({ error: 'audio' });
  }
}
