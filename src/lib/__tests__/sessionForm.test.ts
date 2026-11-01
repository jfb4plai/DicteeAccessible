import { describe, it, expect } from 'vitest';
import { validateSessionInput } from '../sessionForm';

const options = { showCorrect: false, readAloud: true, finalRound: true };
const valid = { title: 'Dictée du 16/11', level: 'P3', mode: 'class', wordsText: 'monsieur – droit', pupilIds: ['p1'], options };

describe('validateSessionInput', () => {
  it('accepte une saisie complète', () => {
    const r = validateSessionInput(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.words).toEqual(['monsieur', 'droit']);
  });
  it('refuse un titre vide', () => {
    const r = validateSessionInput({ ...valid, title: '  ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.title).toBeDefined();
  });
  it('refuse zéro mot', () => {
    const r = validateSessionInput({ ...valid, wordsText: '' });
    if (r.ok) throw new Error('attendu un refus');
    expect(r.errors.words).toBe('Ajoute au moins un mot.');
  });
  it('refuse plus de 40 mots', () => {
    const many = Array.from({ length: 41 }, (_, i) => `mot${i}`).join('\n');
    const r = validateSessionInput({ ...valid, wordsText: many });
    if (r.ok) throw new Error('attendu un refus');
    expect(r.errors.words).toBeDefined();
  });
  it('signale les doublons sans refuser', () => {
    const r = validateSessionInput({ ...valid, wordsText: 'paire\npaire' });
    if (!r.ok) throw new Error('attendu un succès');
    expect(r.value.words).toEqual(['paire']);
    expect(r.duplicates).toEqual(['paire']);
  });
  it('refuse zéro élève', () => {
    const r = validateSessionInput({ ...valid, pupilIds: [] });
    if (r.ok) throw new Error('attendu un refus');
    expect(r.errors.pupils).toBe('Choisis au moins un élève.');
  });
  it('refuse un niveau inconnu', () => {
    const r = validateSessionInput({ ...valid, level: 'P7' });
    if (r.ok) throw new Error('attendu un refus');
    expect(r.errors.level).toBeDefined();
  });
});
