import { isCorrectAnswer } from './letters';
import type { AttemptRow, DictaItem, SaveJob } from './types';

// Lignes du serveur + envois mémorisés pas encore partis : la reprise après rechargement tient compte des deux.
export function applyPendingJobs(rows: AttemptRow[], jobs: SaveJob[], items: DictaItem[]): AttemptRow[] {
  const out = [...rows];
  for (const job of jobs) {
    if (job.kind === 'help') {
      out.push({ itemId: job.itemId, stage: job.stage, kind: 'help', attemptNumber: 0, correct: null });
      continue;
    }
    const item = items.find(i => i.id === job.itemId);
    const attemptNumber = out.filter(r => r.itemId === job.itemId && r.stage === job.stage && r.kind === 'attempt').length + 1;
    out.push({
      itemId: job.itemId,
      stage: job.stage,
      kind: 'attempt',
      attemptNumber,
      correct: item ? isCorrectAnswer(job.answer, item.word) : false,
    });
  }
  return out;
}
