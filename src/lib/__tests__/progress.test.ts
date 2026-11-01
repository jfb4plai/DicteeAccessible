import { describe, it, expect } from 'vitest';
import { summarizeItem, summarizeSession, nextTask, type ItemSummary } from '../progress';
import type { AttemptRow, DictaItem, Stage } from '../types';

const items: DictaItem[] = [
  { id: 'i1', word: 'chat', position: 0 },
  { id: 'i2', word: 'lendemain', position: 1 },
  { id: 'i3', word: 'paire', position: 2 },
];

function att(itemId: string, stage: Stage, n: number, correct: boolean, extra: Partial<AttemptRow> = {}): AttemptRow {
  return { itemId, stage, kind: 'attempt', attemptNumber: n, correct, ...extra };
}
function help(itemId: string, stage: Stage = 'A'): AttemptRow {
  return { itemId, stage, kind: 'help', attemptNumber: 0, correct: null };
}

describe('summarizeItem', () => {
  const chat = items[0];
  it('gris sans ligne', () => {
    const s = summarizeItem(chat, [], true);
    expect([s.status, s.label]).toEqual(['grey', 'non fait']);
  });
  it('vert au premier coup', () => {
    const s = summarizeItem(chat, [att('i1', 'A', 1, true)], true);
    expect([s.status, s.label]).toEqual(['green', 'réussi du premier coup']);
  });
  it('orange repris, dernier tour non fait', () => {
    const s = summarizeItem(chat, [att('i1', 'A', 1, false), att('i1', 'A', 2, true)], true);
    expect([s.status, s.label]).toEqual(['orange', 'repris, dernier tour non fait']);
  });
  it('orange repris sans dernier tour prévu', () => {
    const s = summarizeItem(chat, [att('i1', 'A', 1, false), att('i1', 'A', 2, true)], false);
    expect([s.status, s.label]).toEqual(['orange', 'repris']);
  });
  it('orange repris, maîtrisé au dernier tour', () => {
    const rows = [att('i1', 'A', 1, false), att('i1', 'A', 2, true), att('i1', 'C', 1, true)];
    const s = summarizeItem(chat, rows, true);
    expect([s.status, s.label]).toEqual(['orange', 'repris, maîtrisé au dernier tour']);
  });
  it('orange bonne orthographe montrée, maîtrisé au dernier tour', () => {
    const rows = [help('i1'), att('i1', 'A', 1, true), att('i1', 'C', 1, true)];
    const s = summarizeItem(chat, rows, true);
    expect([s.status, s.label]).toEqual(['orange', 'bonne orthographe montrée, maîtrisé au dernier tour']);
  });
  it('rouge quand le premier essai du dernier tour est faux', () => {
    const rows = [help('i1'), att('i1', 'A', 1, true), att('i1', 'C', 1, false), att('i1', 'C', 2, true)];
    const s = summarizeItem(chat, rows, true);
    expect([s.status, s.label]).toEqual(['red', 'bonne orthographe montrée, non maîtrisé']);
  });
  it('orange en cours sans essai A correct', () => {
    const s = summarizeItem(chat, [att('i1', 'A', 1, false)], true);
    expect([s.status, s.label]).toEqual(['orange', 'en cours']);
  });
  it('orange en cours quand seule l\'aide a été demandée', () => {
    const s = summarizeItem(chat, [help('i1')], true);
    expect([s.status, s.label]).toEqual(['orange', 'en cours']);
  });
  it('reprend premier essai, essais, écoutes, aide et captures', () => {
    const rows = [
      att('i1', 'A', 1, false, { answer: 'chta', listens: 2, screenshot: 'data:image/jpeg;base64,xx' }),
      att('i1', 'A', 2, true, { answer: 'chat', listens: 1 }),
    ];
    const s = summarizeItem(chat, rows, true);
    expect(s.firstAnswer).toBe('chta');
    expect(s.attemptsA).toBe(2);
    expect(s.listens).toBe(3);
    expect(s.helpUsed).toBe(false);
    expect(s.screenshots).toEqual(['data:image/jpeg;base64,xx']);
  });
});

describe('summarizeSession', () => {
  it('compte 9 sur 12 du premier coup et 3 à revoir', () => {
    const mk = (status: ItemSummary['status']): ItemSummary => ({
      itemId: 'x', word: 'x', status, label: '', firstAnswer: null, attemptsA: 1, listens: 0, helpUsed: false, screenshots: [],
    });
    const list = [...Array(9).fill(0).map(() => mk('green')), mk('orange'), mk('orange'), mk('red')];
    expect(summarizeSession(list)).toEqual({ total: 12, firstTry: 9, toReview: 3 });
  });
});

describe('nextTask', () => {
  const firstTry = (id: string) => [att(id, 'A', 1, true)];
  const redo = (id: string) => [att(id, 'A', 1, false), att(id, 'A', 2, true)];

  it('commence par le premier mot en A', () => {
    expect(nextTask(items, [], true)).toEqual({ stage: 'A', item: items[0] });
  });
  it('passe au mot suivant en A', () => {
    expect(nextTask(items, firstTry('i1'), true)).toEqual({ stage: 'A', item: items[1] });
  });
  it('propose C seulement pour les mots non réussis du premier coup', () => {
    const rows = [...firstTry('i1'), ...redo('i2'), ...firstTry('i3')];
    expect(nextTask(items, rows, true)).toEqual({ stage: 'C', item: items[1] });
    expect(nextTask(items, [...rows, att('i2', 'C', 1, true)], true)).toBeNull();
  });
  it('ne propose pas C sans dernier tour', () => {
    const rows = [...firstTry('i1'), ...redo('i2'), ...firstTry('i3')];
    expect(nextTask(items, rows, false)).toBeNull();
  });
  it("un mot aidé passe par C même si l'essai A est juste", () => {
    const rows = [help('i1'), ...firstTry('i1'), ...firstTry('i2'), ...firstTry('i3')];
    expect(nextTask(items, rows, true)).toEqual({ stage: 'C', item: items[0] });
  });
});

describe('dernier tour : un seul essai par mot', () => {
  it('un premier essai faux en C termine le mot', () => {
    const rows = [att('i1', 'A', 1, true), att('i2', 'A', 1, false), att('i2', 'A', 2, true), att('i3', 'A', 1, true), att('i2', 'C', 1, false)];
    expect(nextTask(items, rows, true)).toBeNull();
  });
});

describe('captures', () => {
  it('ne garde que les images en data:image', () => {
    const rows = [
      att('i1', 'A', 1, false, { screenshot: 'https://exemple.org/p.png' }),
      att('i1', 'A', 2, true, { screenshot: 'data:image/jpeg;base64,xx' }),
    ];
    expect(summarizeItem(items[0], rows, true).screenshots).toEqual(['data:image/jpeg;base64,xx']);
  });
});
