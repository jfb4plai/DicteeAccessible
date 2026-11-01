import { describe, it, expect } from 'vitest';
import { validateSessionInput } from '../sessionForm';

const options = { showCorrect: false, readAloud: true, finalRound: true };
const base = { title: 'Autodictée du 23/11', level: 'P3', mode: 'class', pupilIds: ['p1'], options };

describe('validateSessionInput : contenu de la dictée', () => {
  it('accepte zéro mot pour une dictée de phrases', () => {
    const r = validateSessionInput({ ...base, wordsText: '', contents: 'sentences' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.words).toEqual([]);
      expect(r.value.contents).toBe('sentences');
    }
  });
  it('refuse zéro mot pour une dictée de mots', () => {
    const r = validateSessionInput({ ...base, wordsText: '', contents: 'words' });
    if (r.ok) throw new Error('attendu un refus');
    expect(r.errors.words).toBe('Ajoute au moins un mot.');
  });
  it('refuse zéro mot pour mots et phrases', () => {
    const r = validateSessionInput({ ...base, wordsText: '', contents: 'words+sentences' });
    expect(r.ok).toBe(false);
  });
  it('refuse un contenu inconnu', () => {
    const r = validateSessionInput({ ...base, wordsText: 'chat', contents: 'images' });
    if (r.ok) throw new Error('attendu un refus');
    expect(r.errors.contents).toBeDefined();
  });
  it('contenu « mots » par défaut', () => {
    const r = validateSessionInput({ ...base, wordsText: 'chat' });
    expect(r.ok && r.value.contents).toBe('words');
  });
});
