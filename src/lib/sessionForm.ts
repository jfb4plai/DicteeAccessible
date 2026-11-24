import { parseWordList } from './words';
import type { SessionInput, SessionOptions } from './types';

export const MAX_WORDS = 40;
const LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;
const CONTENTS = ['words', 'words+sentences', 'sentences'] as const;
const VOICES = ['adrien', 'jef', 'device'] as const;

type RawSessionForm = {
  title: string;
  level: string;
  mode: string;
  wordsText: string;
  contents?: string;
  voice?: string;
  parasiteCount?: number;
  pupilIds: string[];
  options: SessionOptions;
};

export type SessionFormResult =
  | { ok: true; value: SessionInput; duplicates: string[] }
  | { ok: false; errors: Partial<Record<'title' | 'level' | 'words' | 'pupils' | 'contents' | 'voice' | 'parasiteCount', string>> };

// requirePupils : faux pour la création d'un brouillon, les élèves se choisissent ensuite dans l'onglet « Élèves ».
export function validateSessionInput(raw: RawSessionForm, requirePupils = true): SessionFormResult {
  const errors: Partial<Record<'title' | 'level' | 'words' | 'pupils' | 'contents' | 'voice' | 'parasiteCount', string>> = {};
  const title = raw.title.trim();
  const { words, duplicates } = parseWordList(raw.wordsText);
  const level = LEVELS.find(l => l === raw.level);
  const mode = raw.mode === 'autonomy' || raw.mode === 'class' ? raw.mode : null;
  const contents = CONTENTS.find(c => c === (raw.contents ?? 'words'));
  const voice = VOICES.find(v => v === (raw.voice ?? 'adrien'));
  const parasiteCount = raw.parasiteCount ?? 2;

  if (!title) errors.title = 'Donne un titre pour retrouver la dictée.';
  if (!level || !mode) errors.level = 'Choisis un niveau entre P1 et P6.';
  if (!contents) errors.contents = 'Choisis le contenu de la dictée.';
  if (!voice) errors.voice = 'Choisis une voix de lecture.';
  if (!Number.isInteger(parasiteCount) || parasiteCount < 0 || parasiteCount > 3) errors.parasiteCount = 'Choisis un nombre de parasites entre 0 et 3.';
  if (words.length === 0 && contents !== 'sentences') errors.words = 'Ajoute au moins un mot.';
  else if (words.length > MAX_WORDS) errors.words = `Maximum ${MAX_WORDS} mots par dictée.`;
  if (requirePupils && raw.pupilIds.length === 0) errors.pupils = 'Choisis au moins un élève.';

  if (Object.keys(errors).length > 0 || !level || !mode || !contents || !voice) return { ok: false, errors };
  return { ok: true, value: { title, level, mode, words, contents, voice, parasiteCount, pupilIds: raw.pupilIds, options: raw.options }, duplicates };
}
