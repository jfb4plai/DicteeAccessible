import { sentenceUnlocked } from './sentences';
import type { AttemptRow, DictaItem, DictaSentence } from './types';

export type ItemStatus = 'green' | 'orange' | 'red' | 'grey';

export type ItemSummary = {
  itemId: string;
  word: string;
  status: ItemStatus;
  label: string;
  firstAnswer: string | null;
  attemptsA: number;
  listens: number;
  helpUsed: boolean;
  screenshots: string[];
};

const attemptsAt = (rows: AttemptRow[], stage: 'A' | 'C') =>
  rows.filter(r => r.kind === 'attempt' && r.stage === stage);

const byAttemptNumber = (a: AttemptRow, b: AttemptRow) => a.attemptNumber - b.attemptNumber;

function isFirstTry(rows: AttemptRow[]): boolean {
  const first = [...attemptsAt(rows, 'A')].sort(byAttemptNumber)[0];
  return !!first && first.correct === true && !rows.some(r => r.kind === 'help');
}

export function summarizeItem(item: DictaItem, allRows: AttemptRow[], finalRound: boolean): ItemSummary {
  const rows = allRows.filter(r => r.itemId === item.id);
  const attemptsA = [...attemptsAt(rows, 'A')].sort(byAttemptNumber);
  const helpUsed = rows.some(r => r.kind === 'help');

  const base = {
    itemId: item.id,
    word: item.word,
    firstAnswer: attemptsA[0]?.answer ?? null,
    attemptsA: attemptsA.length,
    listens: rows.reduce((sum, r) => sum + (r.listens ?? 0), 0),
    helpUsed,
    screenshots: rows.map(r => r.screenshot).filter((s): s is string => !!s && s.startsWith('data:image/')),
  };

  if (rows.length === 0) return { ...base, status: 'grey', label: 'non fait' };
  if (isFirstTry(rows)) return { ...base, status: 'green', label: 'réussi du premier coup' };
  if (!attemptsA.some(r => r.correct === true)) return { ...base, status: 'orange', label: 'en cours' };

  const start = helpUsed ? 'bonne orthographe montrée' : 'repris';
  const firstC = [...attemptsAt(rows, 'C')].sort(byAttemptNumber)[0];
  if (firstC) {
    return firstC.correct === true
      ? { ...base, status: 'orange', label: `${start}, maîtrisé au dernier tour` }
      : { ...base, status: 'red', label: `${start}, non maîtrisé` };
  }
  return { ...base, status: 'orange', label: finalRound ? `${start}, dernier tour non fait` : start };
}

export function summarizeSession(summaries: ItemSummary[]): { total: number; firstTry: number; toReview: number } {
  return {
    total: summaries.length,
    firstTry: summaries.filter(s => s.status === 'green').length,
    toReview: summaries.filter(s => s.status === 'orange' || s.status === 'red').length,
  };
}

const firstTodoA = (items: DictaItem[], rows: AttemptRow[]) =>
  items.find(item => !attemptsAt(rows.filter(r => r.itemId === item.id), 'A').some(r => r.correct === true));

// Dernier tour : un seul essai par mot, seulement pour les mots non réussis du premier coup.
const firstTodoC = (items: DictaItem[], rows: AttemptRow[]) =>
  items.find(item => {
    const own = rows.filter(r => r.itemId === item.id);
    return !isFirstTry(own) && attemptsAt(own, 'C').length === 0;
  });

export function nextTask(
  items: DictaItem[],
  rows: AttemptRow[],
  finalRound: boolean,
): { stage: 'A' | 'C'; item: DictaItem } | null {
  const a = firstTodoA(items, rows);
  if (a) return { stage: 'A', item: a };
  if (!finalRound) return null;
  const c = firstTodoC(items, rows);
  return c ? { stage: 'C', item: c } : null;
}

export type Step = { stage: 'A' | 'B1' | 'B2' | 'C'; item?: DictaItem; sentence?: DictaSentence };

// Ordre : A (mots), B1 (autonomie seulement), B2, C (mots non réussis du premier coup).
// En classe, B2 n'a qu'un essai par phrase.
export function nextStep(ctx: {
  items: DictaItem[];
  sentences: DictaSentence[];
  rows: AttemptRow[];
  mode: 'autonomy' | 'class';
  finalRound: boolean;
}): Step | null {
  const { items, rows, mode, finalRound } = ctx;
  const a = firstTodoA(items, rows);
  if (a) return { stage: 'A', item: a };

  const unlocked = [...ctx.sentences]
    .sort((x, y) => x.position - y.position)
    .filter(s => sentenceUnlocked(s, items, rows));
  const attemptsOf = (s: DictaSentence, stage: 'B1' | 'B2') =>
    rows.filter(r => r.sentenceId === s.id && r.stage === stage && r.kind === 'attempt');

  if (mode === 'autonomy') {
    const b1 = unlocked.find(s => !attemptsOf(s, 'B1').some(r => r.correct === true));
    if (b1) return { stage: 'B1', sentence: b1 };
  }
  const b2 = unlocked.find(s =>
    mode === 'class' ? attemptsOf(s, 'B2').length === 0 : !attemptsOf(s, 'B2').some(r => r.correct === true));
  if (b2) return { stage: 'B2', sentence: b2 };

  if (finalRound) {
    const c = firstTodoC(items, rows);
    if (c) return { stage: 'C', item: c };
  }
  return null;
}

export type SentenceSummary = {
  sentenceId: string;
  text: string;
  status: ItemStatus;
  label: string;
  firstAnswer: string | null;
  attempts: number;
};

export function summarizeSentence(s: DictaSentence, allRows: AttemptRow[], mode: 'autonomy' | 'class'): SentenceSummary {
  const rows = allRows.filter(r => r.sentenceId === s.id);
  const b2 = rows.filter(r => r.kind === 'attempt' && r.stage === 'B2').sort(byAttemptNumber);
  const base = { sentenceId: s.id, text: s.text, firstAnswer: b2[0]?.answer ?? null, attempts: b2.length };

  if (rows.length === 0) return { ...base, status: 'grey', label: 'non fait' };
  const first = b2[0];
  if (!first) return { ...base, status: 'orange', label: 'en cours' };
  if (first.correct === true) return { ...base, status: 'green', label: 'réussie du premier coup' };
  if (mode === 'class') return { ...base, status: 'red', label: 'non réussie' };
  return b2.some(r => r.correct === true)
    ? { ...base, status: 'orange', label: 'reprise' }
    : { ...base, status: 'orange', label: 'en cours' };
}
