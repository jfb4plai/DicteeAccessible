import { isCorrectAnswer } from './letters';
import { isCorrectSentenceAnswer } from './sentences';
import type { AttemptRow, DictaItem, DictaSentence, SaveJob } from './types';

// Lignes du serveur + envois mémorisés pas encore partis : la reprise après rechargement tient compte des deux.
export function applyPendingJobs(rows: AttemptRow[], jobs: SaveJob[], items: DictaItem[], sentences: DictaSentence[] = []): AttemptRow[] {
  const out = [...rows];
  for (const job of jobs) {
    if (job.kind === 'help') {
      out.push({ itemId: job.itemId, stage: job.stage, kind: 'help', attemptNumber: 0, correct: null });
      continue;
    }
    if (job.kind === 'sentence') {
      const sentence = sentences.find(x => x.id === job.sentenceId);
      const attemptNumber = out.filter(r => r.sentenceId === job.sentenceId && r.stage === job.stage && r.kind === 'attempt').length + 1;
      out.push({
        itemId: '',
        sentenceId: job.sentenceId,
        stage: job.stage,
        kind: 'attempt',
        attemptNumber,
        correct: sentence ? isCorrectSentenceAnswer(job.answer.split(' '), sentence.text) : false,
      });
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
