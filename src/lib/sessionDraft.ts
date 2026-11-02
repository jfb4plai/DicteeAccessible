import type { Contents, SessionOptions, Voice } from './types';

// Brouillon du formulaire « Nouvelle dictée », gardé le temps de l'onglet : quitter la page (par exemple pour créer
// des codes élèves) ne doit pas effacer ce qui a été saisi. Aucun prénom n'est concerné : titre, mots, choix.
export type SessionDraft = {
  contents: Contents; voice: Voice; title: string; level: string; wordsText: string;
  mode: 'autonomy' | 'class'; options: SessionOptions; pupilIds: string[];
};

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const KEY = 'dicta:draft:v1';

const defaultStorage = (): DraftStorage | null => {
  try { return sessionStorage; } catch { return null; }
};

function isDraft(v: unknown): v is SessionDraft {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  const o = d.options as Record<string, unknown> | undefined;
  return ['words', 'words+sentences', 'sentences'].includes(d.contents as string)
    && ['adrien', 'jef', 'device'].includes(d.voice as string)
    && typeof d.title === 'string' && typeof d.level === 'string' && typeof d.wordsText === 'string'
    && (d.mode === 'autonomy' || d.mode === 'class')
    && !!o && typeof o.showCorrect === 'boolean' && typeof o.readAloud === 'boolean' && typeof o.finalRound === 'boolean'
    && Array.isArray(d.pupilIds) && d.pupilIds.every(id => typeof id === 'string');
}

export function saveDraft(draft: SessionDraft, storage: DraftStorage | null = defaultStorage()): void {
  try { storage?.setItem(KEY, JSON.stringify(draft)); } catch { /* stockage refusé : le formulaire marche sans brouillon */ }
}

export function loadDraft(storage: DraftStorage | null = defaultStorage()): SessionDraft | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDraft(storage: DraftStorage | null = defaultStorage()): void {
  try { storage?.removeItem(KEY); } catch { /* idem */ }
}
