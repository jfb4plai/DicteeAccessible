import { describe, it, expect } from 'vitest';
import { nextStep, summarizeSentence } from '../progress';
import type { AttemptRow, DictaItem, DictaSentence, Stage } from '../types';

const items: DictaItem[] = [
  { id: 'i1', word: 'chat', position: 0 },
  { id: 'i2', word: 'lendemain', position: 1 },
  { id: 'i3', word: 'paire', position: 2 },
];
const sentences: DictaSentence[] = [
  { id: 's1', position: 0, text: 'Le chat dort.', parasites: ['dormir'], itemId: 'i1' },
  { id: 's2', position: 1, text: 'Le lendemain, il pleut.', parasites: [], itemId: 'i2' },
];

function att(itemId: string, stage: Stage, n: number, correct: boolean): AttemptRow {
  return { itemId, stage, kind: 'attempt', attemptNumber: n, correct };
}
function satt(sentenceId: string, stage: Stage, n: number, correct: boolean, answer?: string): AttemptRow {
  return { itemId: '', sentenceId, stage, kind: 'attempt', attemptNumber: n, correct, ...(answer ? { answer } : {}) };
}
const allA = [att('i1', 'A', 1, true), att('i2', 'A', 1, true), att('i3', 'A', 1, true)];

describe('nextStep : autonomie, mots et phrases', () => {
  const ctx = { items, sentences, mode: 'autonomy' as const, finalRound: true };

  it('commence par A', () => {
    expect(nextStep({ ...ctx, rows: [] })).toEqual({ stage: 'A', item: items[0] });
  });
  it('passe à B1 une fois tous les mots réussis', () => {
    expect(nextStep({ ...ctx, rows: allA })).toEqual({ stage: 'B1', sentence: sentences[0] });
  });
  it('passe à B2 une fois toutes les phrases réussies en B1', () => {
    const rows = [...allA, satt('s1', 'B1', 1, true), satt('s2', 'B1', 1, true)];
    expect(nextStep({ ...ctx, rows })).toEqual({ stage: 'B2', sentence: sentences[0] });
  });
  it('reste sur la même phrase tant qu\'elle n\'est pas juste en B2', () => {
    const rows = [...allA, satt('s1', 'B1', 1, true), satt('s2', 'B1', 1, true), satt('s1', 'B2', 1, false)];
    expect(nextStep({ ...ctx, rows })).toEqual({ stage: 'B2', sentence: sentences[0] });
  });
  it('termine par C pour les mots non réussis du premier coup, puis null', () => {
    const rows = [
      att('i1', 'A', 1, true), att('i2', 'A', 1, false), att('i2', 'A', 2, true), att('i3', 'A', 1, true),
      satt('s1', 'B1', 1, true), satt('s2', 'B1', 1, true), satt('s1', 'B2', 1, true), satt('s2', 'B2', 1, true),
    ];
    expect(nextStep({ ...ctx, rows })).toEqual({ stage: 'C', item: items[1] });
    expect(nextStep({ ...ctx, rows: [...rows, att('i2', 'C', 1, true)] })).toBeNull();
  });
});

describe('nextStep : classe', () => {
  it('phrases seules : B2 directement, jamais B1, un essai suffit', () => {
    const ctx = { items: [] as DictaItem[], sentences, mode: 'class' as const, finalRound: true };
    expect(nextStep({ ...ctx, rows: [] })).toEqual({ stage: 'B2', sentence: sentences[0] });
    const afterWrong = [satt('s1', 'B2', 1, false)];
    expect(nextStep({ ...ctx, rows: afterWrong })).toEqual({ stage: 'B2', sentence: sentences[1] });
    expect(nextStep({ ...ctx, rows: [...afterWrong, satt('s2', 'B2', 1, true)] })).toBeNull();
  });
  it('mots et phrases : A, puis B2, puis C', () => {
    const ctx = { items, sentences, mode: 'class' as const, finalRound: true };
    expect(nextStep({ ...ctx, rows: allA })).toEqual({ stage: 'B2', sentence: sentences[0] });
  });
});

describe('summarizeSentence', () => {
  const s = sentences[0];
  it('gris sans ligne', () => {
    const r = summarizeSentence(s, [], 'autonomy');
    expect([r.status, r.label]).toEqual(['grey', 'non fait']);
  });
  it('vert quand le premier essai B2 est juste', () => {
    const r = summarizeSentence(s, [satt('s1', 'B2', 1, true, 'Le chat dort.')], 'autonomy');
    expect([r.status, r.label, r.attempts, r.firstAnswer]).toEqual(['green', 'réussie du premier coup', 1, 'Le chat dort.']);
  });
  it('orange reprise quand B2 est juste après des essais', () => {
    const r = summarizeSentence(s, [satt('s1', 'B2', 1, false), satt('s1', 'B2', 2, true)], 'autonomy');
    expect([r.status, r.label, r.attempts]).toEqual(['orange', 'reprise', 2]);
  });
  it('orange en cours avec seulement B1 ou un B2 faux', () => {
    expect(summarizeSentence(s, [satt('s1', 'B1', 1, true)], 'autonomy').label).toBe('en cours');
    expect(summarizeSentence(s, [satt('s1', 'B2', 1, false)], 'autonomy').label).toBe('en cours');
  });
  it('rouge en classe quand le premier essai est faux', () => {
    const r = summarizeSentence(s, [satt('s1', 'B2', 1, false)], 'class');
    expect([r.status, r.label]).toEqual(['red', 'non réussie']);
  });
});
