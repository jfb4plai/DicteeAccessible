import { describe, it, expect } from 'vitest';
import { toOpenedSession, normalizeCode } from '../apiMapping';

describe('toOpenedSession', () => {
  it('convertit le JSON de dicta_open_session en objets camelCase', () => {
    const raw = {
      session_id: 's1',
      title: 'Dictée du 16/11',
      mode: 'class',
      options: { show_correct: false, read_aloud: true, final_round: true },
      items: [{ id: 'i1', word: 'chat', position: 0 }],
      attempts: [{ item_id: 'i1', stage: 'A', kind: 'attempt', attempt_number: 1, correct: true }],
    };
    expect(toOpenedSession(raw)).toEqual({
      sessionId: 's1',
      title: 'Dictée du 16/11',
      mode: 'class',
      options: { showCorrect: false, readAloud: true, finalRound: true },
      items: [{ id: 'i1', word: 'chat', position: 0 }],
      attempts: [{ itemId: 'i1', stage: 'A', kind: 'attempt', attemptNumber: 1, correct: true }],
    });
  });

  it('trie les mots par position', () => {
    const raw = {
      session_id: 's1', title: 't', mode: 'autonomy',
      options: { show_correct: true, read_aloud: true, final_round: true },
      items: [{ id: 'b', word: 'b', position: 1 }, { id: 'a', word: 'a', position: 0 }],
      attempts: [],
    };
    expect(toOpenedSession(raw).items.map(i => i.id)).toEqual(['a', 'b']);
  });
});

describe('normalizeCode', () => {
  it('retire les espaces et met en majuscules', () => {
    expect(normalizeCode('  k7m2qx ')).toBe('K7M2QX');
    expect(normalizeCode('e 1')).toBe('E1');
  });
});
