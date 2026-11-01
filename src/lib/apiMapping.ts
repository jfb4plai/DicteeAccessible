import type { AttemptRow, OpenedSession, Stage } from './types';

export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase();
}

// Ligne de dicta_attempts ou entrée du JSON de dicta_open_session, en camelCase.
export function toAttemptRow(r: any): AttemptRow {
  return {
    itemId: r.item_id ?? '',
    ...(r.sentence_id && { sentenceId: r.sentence_id }),
    stage: r.stage as Stage,
    kind: r.kind,
    attemptNumber: r.attempt_number,
    correct: r.correct ?? null,
    ...(r.answer !== undefined && { answer: r.answer }),
    ...(r.listens !== undefined && { listens: r.listens }),
    ...(r.screenshot !== undefined && { screenshot: r.screenshot }),
  };
}

export function toOpenedSession(raw: any): OpenedSession {
  return {
    sessionId: raw.session_id,
    mode: raw.mode,
    options: {
      showCorrect: raw.options.show_correct,
      readAloud: raw.options.read_aloud,
      finalRound: raw.options.final_round,
    },
    items: [...raw.items].sort((a: any, b: any) => a.position - b.position),
    sentences: [...(raw.sentences ?? [])]
      .sort((a: any, b: any) => a.position - b.position)
      .map((s: any) => ({ id: s.id, position: s.position, text: s.text, parasites: s.parasites ?? [], itemId: s.item_id ?? null })),
    attempts: raw.attempts.map(toAttemptRow),
  };
}
