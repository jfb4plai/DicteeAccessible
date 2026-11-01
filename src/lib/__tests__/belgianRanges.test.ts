import { describe, it, expect } from 'vitest';
import { numbersToBelgianWords } from '../belgianNumbers';
import { applyLexicon } from '../belgianSpeech';

describe('numbersToBelgianWords : périodes, dates et heures laissées telles quelles', () => {
  it.each([
    '1990-2024', '1914–1918', '1914—1918', 'Le 16/11/2024.', '10:70', 'à 9 h 30', 'à 14 h 05', 'à 9h30', 'de 8 h à 10 h',
  ])('%s', text => {
    expect(numbersToBelgianWords(text)).toBe(text);
  });
  it('convertit les nombres isolés d\'une phrase qui contient aussi une période', () => {
    expect(numbersToBelgianWords('Il a 90 ans, de 1990-2024.')).toBe('Il a nonante ans, de 1990-2024.');
  });
  it('convertit deux nombres séparés par une espace', () => {
    expect(numbersToBelgianWords('70 90')).toBe('septante nonante');
  });
});

describe('sans lookbehind (anciennes tablettes)', () => {
  it('aucun lookbehind dans les expressions régulières partagées avec le navigateur', async () => {
    const { readFileSync } = await import('node:fs');
    for (const file of ['belgianNumbers.ts', 'belgianSpeech.ts']) {
      const code = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      expect(code, file).not.toMatch(/\(\?<[!=]/);
    }
  });
  it('le lexique garde son comportement', () => {
    expect(applyLexicon('wagon wagon, Wallonie')).toBe('ouagon ouagon, Ouallonie');
  });
});
