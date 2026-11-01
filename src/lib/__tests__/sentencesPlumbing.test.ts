import { describe, it, expect } from 'vitest';
import { applyPendingJobs } from '../pendingRows';
import { toOpenedSession } from '../apiMapping';
import type { DictaSentence, SaveJob } from '../types';

const sentences: DictaSentence[] = [{ id: 's1', position: 0, text: 'Le chat dort.', parasites: [], itemId: null }];

describe('applyPendingJobs avec des phrases', () => {
  it('ajoute les essais de phrase en attente, avec justesse et numérotation continue', () => {
    const jobs: SaveJob[] = [
      { kind: 'sentence', sentenceId: 's1', stage: 'B2', answer: 'chat Le dort.', listens: 1 },
      { kind: 'sentence', sentenceId: 's1', stage: 'B2', answer: 'Le chat dort.', listens: 0 },
    ];
    const rows = applyPendingJobs([], jobs, [], sentences);
    expect(rows.map(r => [r.sentenceId, r.stage, r.attemptNumber, r.correct])).toEqual([
      ['s1', 'B2', 1, false],
      ['s1', 'B2', 2, true],
    ]);
  });
});

describe('toOpenedSession avec des phrases', () => {
  const base = { session_id: 's', mode: 'class', options: { show_correct: false, read_aloud: true, final_round: true }, items: [] };
  it('lit les phrases et le sentence_id des lignes', () => {
    const out = toOpenedSession({
      ...base,
      sentences: [{ id: 's1', position: 0, text: 'Le chat dort.', parasites: ['dormir'], item_id: null }],
      attempts: [{ sentence_id: 's1', stage: 'B2', kind: 'attempt', attempt_number: 1, correct: true }],
    });
    expect(out.sentences).toEqual([{ id: 's1', position: 0, text: 'Le chat dort.', parasites: ['dormir'], itemId: null }]);
    expect(out.attempts[0]).toEqual({ itemId: '', sentenceId: 's1', stage: 'B2', kind: 'attempt', attemptNumber: 1, correct: true });
  });
  it('liste vide sans phrases', () => {
    expect(toOpenedSession({ ...base, attempts: [] }).sentences).toEqual([]);
  });
});
