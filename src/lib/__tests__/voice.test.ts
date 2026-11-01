import { describe, it, expect } from 'vitest';
import { buildSpeakUrl } from '../audioUrl';
import { validateSessionInput } from '../sessionForm';
import { toOpenedSession } from '../apiMapping';

describe('buildSpeakUrl', () => {
  const base = { accessCode: ' gh7fcv ', kind: 'word' as const, id: '00000000-0000-0000-0000-0000000000d1', hash: 'abcdef0123456789' };
  it('normalise le code et porte seulement des identifiants', () => {
    expect(buildSpeakUrl(base)).toBe('/api/speak?session=GH7FCV&kind=word&id=00000000-0000-0000-0000-0000000000d1&h=abcdef0123456789');
  });
  it('encode les paramètres', () => {
    expect(buildSpeakUrl({ ...base, accessCode: 'A&B' })).toContain('session=A%26B');
  });
  it('type phrase', () => {
    expect(buildSpeakUrl({ ...base, kind: 'sentence' })).toContain('kind=sentence');
  });
});

describe('validateSessionInput : voix', () => {
  const options = { showCorrect: false, readAloud: true, finalRound: true };
  const base = { title: 'T', level: 'P3', mode: 'class', wordsText: 'chat', pupilIds: ['p1'], options };
  it('Adrien par défaut', () => {
    const r = validateSessionInput(base);
    expect(r.ok && r.value.voice).toBe('adrien');
  });
  it.each(['adrien', 'jef', 'device'])('accepte %s', voice => {
    const r = validateSessionInput({ ...base, voice });
    expect(r.ok && r.value.voice).toBe(voice);
  });
  it('refuse une voix inconnue', () => {
    const r = validateSessionInput({ ...base, voice: 'robot' });
    if (r.ok) throw new Error('attendu un refus');
    expect(r.errors.voice).toBeDefined();
  });
});

describe('toOpenedSession : voix', () => {
  const raw = { session_id: 's', mode: 'class', options: { show_correct: false, read_aloud: true, final_round: true }, items: [], attempts: [] };
  it('lit la voix', () => {
    expect(toOpenedSession({ ...raw, voice: 'jef' }).voice).toBe('jef');
  });
  it('Adrien quand le champ manque ou est inconnu', () => {
    expect(toOpenedSession(raw).voice).toBe('adrien');
    expect(toOpenedSession({ ...raw, voice: 'robot' }).voice).toBe('adrien');
  });
});
