import { describe, it, expect } from 'vitest';
import { warmAudio } from '../warmAudio';
import { audioHash } from '../audioHash';

const targets = [
  { kind: 'word' as const, id: '00000000-0000-0000-0000-0000000000d1', text: 'chat' },
  { kind: 'word' as const, id: '00000000-0000-0000-0000-0000000000d2', text: 'peut-être' },
  { kind: 'sentence' as const, id: '00000000-0000-0000-0000-0000000000e1', text: 'Il a 90 ans.' },
];

describe('warmAudio', () => {
  it('demande chaque audio une fois, avec l\'empreinte de la voix', async () => {
    const urls: string[] = [];
    await warmAudio(targets, { accessCode: 'abcdef', voice: 'adrien', fetchFn: async u => { urls.push(u); return new Response('', { status: 200 }); } });
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain('session=ABCDEF');
    expect(urls[2]).toContain(`h=${await audioHash('adrien', 'Il a 90 ans.')}`);
  });

  it('ne demande rien avec la voix de l\'appareil', async () => {
    let calls = 0;
    await warmAudio(targets, { accessCode: 'ABCDEF', voice: 'device', fetchFn: async () => { calls++; return new Response(''); } });
    expect(calls).toBe(0);
  });

  it('continue après un échec et ne lève jamais', async () => {
    let calls = 0;
    const r = await warmAudio(targets, {
      accessCode: 'ABCDEF', voice: 'jef',
      fetchFn: async () => { calls++; if (calls === 1) throw new Error('réseau'); return new Response('', { status: 502 }); },
    });
    expect(calls).toBe(3);
    expect(r).toEqual({ requested: 3, ok: 0 });
  });

  it('limite le nombre de demandes simultanées', async () => {
    let running = 0;
    let max = 0;
    const many = Array.from({ length: 8 }, (_, i) => ({ kind: 'word' as const, id: `00000000-0000-0000-0000-00000000000${i}`, text: `mot${i}` }));
    await warmAudio(many, {
      accessCode: 'ABCDEF', voice: 'adrien', concurrency: 2,
      fetchFn: async () => { running++; max = Math.max(max, running); await new Promise(r => setTimeout(r, 5)); running--; return new Response('', { status: 200 }); },
    });
    expect(max).toBeLessThanOrEqual(2);
  });
});
