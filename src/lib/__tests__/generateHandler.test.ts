import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../../../api/generate-sentences';

function makeRes() {
  const res = {
    code: 0, body: undefined as unknown, headers: {} as Record<string, string>,
    status(c: number) { res.code = c; return res; },
    json(b: unknown) { res.body = b; },
    setHeader(k: string, v: string) { res.headers[k] = v; },
  };
  return res;
}
const validBody = { words: ['soufflé'], level: 'P3' };
const reqOf = (over: Record<string, unknown> = {}) => ({
  method: 'POST', headers: { authorization: 'Bearer jeton' }, body: validBody, ...over,
});

describe('api/generate-sentences : garde-fous avant tout appel à l\'IA', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    vi.stubEnv('ANTHROPIC_API_KEY', 'cle-de-test');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('refuse une autre méthode que POST', async () => {
    const res = makeRes();
    await handler(reqOf({ method: 'GET' }) as never, res as never);
    expect(res.code).toBe(405);
  });

  it('refuse sans jeton', async () => {
    const res = makeRes();
    await handler(reqOf({ headers: {} }) as never, res as never);
    expect(res.code).toBe(401);
  });

  it('refuse un jeton que Supabase rejette', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    const res = makeRes();
    await handler(reqOf() as never, res as never);
    expect(res.code).toBe(401);
  });

  it('refuse une entrée invalide', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    const res = makeRes();
    await handler(reqOf({ body: { words: [], level: 'P3' } }) as never, res as never);
    expect(res.code).toBe(400);
  });

  it('répond 429 quand le plafond du jour est atteint, sans appeler l\'IA', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      if (String(url).includes('/auth/v1/user')) return new Response('{}', { status: 200 });
      return new Response('{"message":"quota_exceeded"}', { status: 400 });
    }));
    const res = makeRes();
    await handler(reqOf() as never, res as never);
    expect(res.code).toBe(429);
    expect(res.body).toEqual({ error: 'quota' });
    expect(calls.some(u => u.includes('anthropic.com'))).toBe(false);
  });

  it('ne divulgue aucun détail quand l\'IA échoue', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/auth/v1/user')) return new Response('{}', { status: 200 });
      if (String(url).includes('dicta_ai_take')) return new Response('1', { status: 200 });
      throw new Error('réseau coupé avec le détail secret');
    }));
    const res = makeRes();
    await handler(reqOf() as never, res as never);
    expect(res.code).toBe(502);
    expect(res.body).toEqual({ error: 'ia' });
  });
});
