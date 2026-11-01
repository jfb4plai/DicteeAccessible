import { describe, it, expect } from 'vitest';
import { applyPendingJobs } from '../pendingRows';
import type { DictaItem, SaveJob } from '../types';

const items: DictaItem[] = [{ id: 'i1', word: 'chat', position: 0 }];

describe('applyPendingJobs', () => {
  it('ajoute aux lignes du serveur les envois encore en attente, avec la justesse et le numéro d\'essai', () => {
    const jobs: SaveJob[] = [
      { kind: 'attempt', itemId: 'i1', stage: 'A', answer: 'chta', listens: 1, screenshot: null },
      { kind: 'help', itemId: 'i1', stage: 'A' },
      { kind: 'attempt', itemId: 'i1', stage: 'A', answer: 'CHAT', listens: 0, screenshot: null },
    ];
    const rows = applyPendingJobs([], jobs, items);
    expect(rows.map(r => [r.kind, r.attemptNumber, r.correct])).toEqual([
      ['attempt', 1, false],
      ['help', 0, null],
      ['attempt', 2, true],
    ]);
  });

  it('continue la numérotation des lignes du serveur', () => {
    const server = [{ itemId: 'i1', stage: 'A' as const, kind: 'attempt' as const, attemptNumber: 1, correct: false }];
    const rows = applyPendingJobs(server, [{ kind: 'attempt', itemId: 'i1', stage: 'A', answer: 'chat', listens: 0, screenshot: null }], items);
    expect(rows[1].attemptNumber).toBe(2);
  });
});
