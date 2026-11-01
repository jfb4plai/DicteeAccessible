import type { AttemptRow, DictaItem } from './types';

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
    screenshots: rows.map(r => r.screenshot).filter((s): s is string => !!s),
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

export function nextTask(
  items: DictaItem[],
  rows: AttemptRow[],
  finalRound: boolean,
): { stage: 'A' | 'C'; item: DictaItem } | null {
  const rowsOf = (item: DictaItem) => rows.filter(r => r.itemId === item.id);

  const todoA = items.find(item => !attemptsAt(rowsOf(item), 'A').some(r => r.correct === true));
  if (todoA) return { stage: 'A', item: todoA };

  if (!finalRound) return null;
  const todoC = items.find(item => {
    const own = rowsOf(item);
    return !isFirstTry(own) && !attemptsAt(own, 'C').some(r => r.correct === true);
  });
  return todoC ? { stage: 'C', item: todoC } : null;
}
