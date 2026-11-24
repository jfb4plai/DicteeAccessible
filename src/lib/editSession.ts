import { normalizeToken } from './sentences';
import type { DictaItem } from './types';

export const MAX_EDIT_WORDS = 40;
const MAX_WORD_LENGTH = 60;

// Une ligne de mot dans le formulaire de modification. `id` présent = mot déjà enregistré : corriger son texte
// garde ses résultats. Un mot retiré de la liste perd les siens (suppression en cascade).
export type WordRow = { id?: string; word: string };

export type WordPlan = {
  upserts: { id?: string; word: string; position: number }[];
  removedIds: string[];
};

export function validateWordRows(rows: WordRow[]): { ok: true; rows: WordRow[] } | { ok: false; error: string } {
  const cleaned = rows.map(r => ({ ...r, word: r.word.trim() })).filter(r => r.word.length > 0);
  if (cleaned.length > MAX_EDIT_WORDS) return { ok: false, error: `Maximum ${MAX_EDIT_WORDS} mots par dictée.` };
  if (cleaned.some(r => r.word.length > MAX_WORD_LENGTH)) return { ok: false, error: `Un mot dépasse ${MAX_WORD_LENGTH} caractères.` };
  const seen = new Set<string>();
  for (const r of cleaned) {
    const key = normalizeToken(r.word);
    if (seen.has(key)) return { ok: false, error: `Le mot « ${r.word} » est en double.` };
    seen.add(key);
  }
  return { ok: true, rows: cleaned };
}

export function planWordChanges(existing: DictaItem[], rows: WordRow[]): WordPlan {
  const keep = new Set(rows.map(r => r.id).filter((id): id is string => !!id));
  return {
    upserts: rows.map((r, position) => ({ ...(r.id && { id: r.id }), word: r.word, position })),
    removedIds: existing.filter(e => !keep.has(e.id)).map(e => e.id),
  };
}

export function planPupilChanges(current: string[], wanted: string[]): { add: string[]; remove: string[] } {
  const have = new Set(current);
  const want = new Set(wanted);
  return { add: wanted.filter(id => !have.has(id)), remove: current.filter(id => !want.has(id)) };
}
