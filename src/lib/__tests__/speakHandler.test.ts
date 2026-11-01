import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../../../api/speak';
import { textHash } from '../audioHash';

const ID = '00000000-0000-0000-0000-0000000000d1';

function makeRes() {
  const res = {
    code: 0, body: undefined as unknown, sent: undefined as Buffer | undefined, headers: {} as Record<string, string>,
    status(c: number) { res.code = c; return res; },
    json(b: unknown) { res.body = b; },
    send(b: Buffer) { res.sent = b; },
    setHeader(k: string, v: string) { res.headers[k] = v; },
  };
  return res;
}
const reqOf = (query: Record<string, string>, method = 'GET') => ({ method, query });

async function goodQuery(text: string, over: Record<string, string> = {}) {
  return { session: 'GH7FCV', kind: 'word', id: ID, h: await textHash(text), ...over };
}

type Call = { url: string; init?: RequestInit };
function stubFetch(opts: { text?: string; voice?: string; rpcStatus?: number; elStatus?: number; elThrows?: boolean }) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/rest/v1/rpc/dicta_audio_text')) {
      if (opts.rpcStatus && opts.rpcStatus !== 200) return new Response('{"message":"invalid_access"}', { status: opts.rpcStatus });
      return new Response(JSON.stringify({ text: opts.text ?? 'Il a 90 ans.', voice: opts.voice ?? 'adrien' }), { status: 200 });
    }
    if (opts.elThrows) throw new Error('réseau coupé, détail secret');
    return new Response(new Uint8Array([1, 2, 3]), { status: opts.elStatus ?? 200, headers: { 'content-type': 'audio/mpeg' } });
  }));
  return calls;
}
const elCalls = (calls: Call[]) => calls.filter(c => c.url.includes('elevenlabs.io'));

describe('api/speak', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    vi.stubEnv('ELEVENLABS_API_KEY', 'cle-elevenlabs-secrete');
    vi.stubEnv('ELEVENLABS_VOICE_ADRIEN', 'VOIX_ADRIEN');
    vi.stubEnv('ELEVENLABS_VOICE_JEF', 'VOIX_JEF');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('refuse une autre méthode que GET', async () => {
    const res = makeRes();
    await handler(reqOf(await goodQuery('Il a 90 ans.'), 'POST') as never, res as never);
    expect(res.code).toBe(405);
  });

  it.each([
    ['session manquante', { session: '' }],
    ['type inconnu', { kind: 'image' }],
    ['id qui n\'est pas un UUID', { id: '123' }],
    ['empreinte mal formée', { h: 'xyz' }],
  ])('400 : %s', async (_label, over) => {
    const calls = stubFetch({});
    const res = makeRes();
    await handler(reqOf(await goodQuery('Il a 90 ans.', over)) as never, res as never);
    expect(res.code).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('404 sans appel à ElevenLabs quand la base refuse', async () => {
    const calls = stubFetch({ rpcStatus: 400 });
    const res = makeRes();
    await handler(reqOf(await goodQuery('Il a 90 ans.')) as never, res as never);
    expect(res.code).toBe(404);
    expect(elCalls(calls)).toHaveLength(0);
  });

  it('409 sans appel à ElevenLabs quand l\'empreinte ne correspond plus au texte', async () => {
    const calls = stubFetch({ text: 'Le texte a changé.' });
    const res = makeRes();
    await handler(reqOf(await goodQuery('Il a 90 ans.')) as never, res as never);
    expect(res.code).toBe(409);
    expect(elCalls(calls)).toHaveLength(0);
  });

  it('404 quand la dictée utilise la voix de l\'appareil', async () => {
    const calls = stubFetch({ voice: 'device' });
    const res = makeRes();
    await handler(reqOf(await goodQuery('Il a 90 ans.')) as never, res as never);
    expect(res.code).toBe(404);
    expect(elCalls(calls)).toHaveLength(0);
  });

  it('cas nominal : envoie « nonante » à ElevenLabs et renvoie l\'audio avec un cache d\'un an', async () => {
    const calls = stubFetch({});
    const res = makeRes();
    await handler(reqOf(await goodQuery('Il a 90 ans.')) as never, res as never);
    expect(res.code).toBe(200);
    expect(res.headers['Content-Type']).toBe('audio/mpeg');
    expect(res.headers['Cache-Control']).toBe('public, max-age=31536000, s-maxage=31536000, immutable');
    expect([...(res.sent ?? [])]).toEqual([1, 2, 3]);

    const [el] = elCalls(calls);
    expect(el.url).toContain('/v1/text-to-speech/VOIX_ADRIEN');
    expect((el.init?.headers as Record<string, string>)['xi-api-key']).toBe('cle-elevenlabs-secrete');
    expect(JSON.parse(String(el.init?.body))).toMatchObject({ text: 'Il a nonante ans.', model_id: 'eleven_multilingual_v2', language_code: 'fr' });
  });

  it('voix jef : utilise l\'identifiant de la voix jef', async () => {
    const calls = stubFetch({ voice: 'jef' });
    const res = makeRes();
    await handler(reqOf(await goodQuery('Il a 90 ans.')) as never, res as never);
    expect(elCalls(calls)[0].url).toContain('/v1/text-to-speech/VOIX_JEF');
  });

  it('une phrase est aussi lue avec le lexique belge', async () => {
    const calls = stubFetch({ text: 'Un wagon.' });
    const res = makeRes();
    await handler(reqOf(await goodQuery('Un wagon.', { kind: 'sentence' })) as never, res as never);
    expect(JSON.parse(String(elCalls(calls)[0].init?.body)).text).toBe('Un ouagon.');
  });

  it('502 sobre quand ElevenLabs refuse, sans divulguer la clé', async () => {
    stubFetch({ elStatus: 401 });
    const res = makeRes();
    await handler(reqOf(await goodQuery('Il a 90 ans.')) as never, res as never);
    expect(res.code).toBe(502);
    expect(res.body).toEqual({ error: 'audio' });
    expect(JSON.stringify(res.body)).not.toContain('cle-elevenlabs');
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('502 sobre quand le réseau échoue', async () => {
    stubFetch({ elThrows: true });
    const res = makeRes();
    await handler(reqOf(await goodQuery('Il a 90 ans.')) as never, res as never);
    expect(res.code).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('500 config quand l\'identifiant de voix manque', async () => {
    vi.stubEnv('ELEVENLABS_VOICE_ADRIEN', '');
    stubFetch({});
    const res = makeRes();
    await handler(reqOf(await goodQuery('Il a 90 ans.')) as never, res as never);
    expect(res.code).toBe(500);
  });
});

describe('textHash', () => {
  it('fait 16 caractères hexadécimaux et change avec le texte', async () => {
    const a = await textHash('Le chat dort.');
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await textHash('Le chat dort!')).not.toBe(a);
  });
  it('est stable pour un même texte, forme composée ou décomposée', async () => {
    expect(await textHash('été')).toBe(await textHash('été'));
  });
});
