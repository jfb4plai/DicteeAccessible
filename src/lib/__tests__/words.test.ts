import { describe, it, expect } from 'vitest';
import { parseWordList } from '../words';

describe('parseWordList', () => {
  it('sépare sur un tiret entouré d\'espaces', () => {
    expect(parseWordList('monsieur – droit – lendemain').words).toEqual(['monsieur', 'droit', 'lendemain']);
  });

  it('sépare sur retour à la ligne, point-virgule et virgule, garde les traits d\'union internes', () => {
    expect(parseWordList("peut-être\naujourd'hui;Été, chaque").words).toEqual(['peut-être', "aujourd'hui", 'Été', 'chaque']);
  });

  it('écarte vides et doublons (insensible à la casse) et renvoie les doublons', () => {
    const r = parseWordList('paire\n\n  paire \nPaire');
    expect(r.words).toEqual(['paire']);
    expect(r.duplicates).toEqual(['paire', 'Paire']);
  });

  it('renvoie des listes vides pour une chaîne vide', () => {
    expect(parseWordList('')).toEqual({ words: [], duplicates: [] });
  });
});

describe('parseWordList normalisation', () => {
  it('stocke les mots en forme composée (NFC)', () => {
    expect(parseWordList('été').words).toEqual(['été']);
  });
});
