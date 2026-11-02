import { toAttemptRow } from './apiMapping';
import { summarizeItem } from './progress';
import type { AttemptRow, DictaItem, DictaSentence } from './types';

export type SharedSession = {
  id: string; title: string; level: string; mode: 'autonomy' | 'class'; createdAt: string; finalRound: boolean;
  items: DictaItem[]; sentences: DictaSentence[]; attempts: AttemptRow[]; comment: string | null;
};
export type SharedView = { pupilCode: string; sessions: SharedSession[] };

export const INVALID_SHARE_MESSAGE = "Cet accès n'est plus valable. Demandez un nouveau lien à l'enseignant(e).";

// JSON de dicta_share_view (snake_case) vers des objets utilisables par progress.ts.
export function toSharedView(raw: any): SharedView {
  return {
    pupilCode: raw.pupil_code,
    sessions: (raw.sessions ?? []).map((s: any): SharedSession => ({
      id: s.id,
      title: s.title,
      level: s.level,
      mode: s.mode,
      createdAt: s.created_at,
      finalRound: s.final_round,
      items: [...(s.items ?? [])].sort((a: DictaItem, b: DictaItem) => a.position - b.position),
      sentences: [...(s.sentences ?? [])]
        .sort((a: any, b: any) => a.position - b.position)
        .map((x: any): DictaSentence => ({ id: x.id, position: x.position, text: x.text, parasites: x.parasites ?? [], itemId: x.item_id ?? null })),
      attempts: (s.attempts ?? []).map(toAttemptRow),
      comment: s.comment ?? null,
    })),
  };
}

// Mots à revoir pour l'ergothérapeute : non maîtrisés au dernier tour, ou jamais réussis malgré plusieurs essais.
export function wordsToReview(view: SharedView): { word: string; sessionId: string; sessionTitle: string }[] {
  const out: { word: string; sessionId: string; sessionTitle: string }[] = [];
  for (const s of view.sessions) {
    for (const item of s.items) {
      const sum = summarizeItem(item, s.attempts, s.finalRound);
      const neverRight = sum.status === 'orange' && sum.label === 'en cours' && sum.attemptsA >= 2;
      if (sum.status === 'red' || neverRight) out.push({ word: item.word, sessionId: s.id, sessionTitle: s.title });
    }
  }
  return out;
}

export function shareErrorMessage(code: string): string {
  if (code.includes('invalid_share')) return INVALID_SHARE_MESSAGE;
  if (code.includes('rate_limited')) return 'Trop de consultations en peu de temps. Réessayez dans une heure.';
  return 'Consultation impossible. Réessayer.';
}
