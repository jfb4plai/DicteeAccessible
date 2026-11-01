import { parseWordList } from './words';
import type { SessionInput, SessionOptions } from './types';

export const MAX_WORDS = 40;
const LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;

type RawSessionForm = {
  title: string;
  level: string;
  mode: string;
  wordsText: string;
  pupilIds: string[];
  options: SessionOptions;
};

export type SessionFormResult =
  | { ok: true; value: SessionInput; duplicates: string[] }
  | { ok: false; errors: Partial<Record<'title' | 'level' | 'words' | 'pupils', string>> };

export function validateSessionInput(raw: RawSessionForm): SessionFormResult {
  const errors: Partial<Record<'title' | 'level' | 'words' | 'pupils', string>> = {};
  const title = raw.title.trim();
  const { words, duplicates } = parseWordList(raw.wordsText);
  const level = LEVELS.find(l => l === raw.level);
  const mode = raw.mode === 'autonomy' || raw.mode === 'class' ? raw.mode : null;

  if (!title) errors.title = 'Donne un titre pour retrouver la dictée.';
  if (!level || !mode) errors.level = 'Choisis un niveau entre P1 et P6.';
  if (words.length === 0) errors.words = 'Ajoute au moins un mot.';
  else if (words.length > MAX_WORDS) errors.words = `Maximum ${MAX_WORDS} mots par dictée.`;
  if (raw.pupilIds.length === 0) errors.pupils = 'Choisis au moins un élève.';

  if (Object.keys(errors).length > 0 || !level || !mode) return { ok: false, errors };
  return { ok: true, value: { title, level, mode, words, pupilIds: raw.pupilIds, options: raw.options }, duplicates };
}
