import { describe, it, expect } from 'vitest';
import { saveDraft, loadDraft, clearDraft, type SessionDraft } from '../sessionDraft';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v; },
    removeItem: (k: string) => { delete data[k]; },
  };
}

const draft: SessionDraft = {
  contents: 'words', voice: 'adrien', title: 'Dictée du 16/11', level: 'P3',
  wordsText: 'monsieur – droit', mode: 'class',
  options: { showCorrect: false, readAloud: true, finalRound: true }, pupilIds: ['a', 'b'],
};

describe('brouillon de dictée', () => {
  it('relit ce qui a été enregistré', () => {
    const s = memoryStorage();
    saveDraft(draft, s);
    expect(loadDraft(s)).toEqual(draft);
  });
  it('clearDraft efface le brouillon', () => {
    const s = memoryStorage();
    saveDraft(draft, s);
    clearDraft(s);
    expect(loadDraft(s)).toBeNull();
  });
  it('un contenu illisible donne null', () => {
    expect(loadDraft(memoryStorage({ 'dicta:draft:v1': '{pas du json' }))).toBeNull();
  });
  it('une forme inattendue donne null', () => {
    expect(loadDraft(memoryStorage({ 'dicta:draft:v1': JSON.stringify({ title: 3 }) }))).toBeNull();
  });
  it('un stockage qui refuse ne casse rien', () => {
    const broken = {
      getItem: () => { throw new Error('bloqué'); },
      setItem: () => { throw new Error('bloqué'); },
      removeItem: () => { throw new Error('bloqué'); },
    };
    expect(() => saveDraft(draft, broken)).not.toThrow();
    expect(loadDraft(broken)).toBeNull();
    expect(() => clearDraft(broken)).not.toThrow();
  });
});
