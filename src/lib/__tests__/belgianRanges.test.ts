import { describe, it, expect } from 'vitest';
import { numbersToBelgianWords } from '../belgianNumbers';
import { applyLexicon } from '../belgianSpeech';

describe('numbersToBelgianWords : plusieurs nombres', () => {
  it('convertit les nombres isolés d une phrase qui contient aussi une période', () => {
    expect(numbersToBelgianWords('Il a 90 ans, de 1990-2024.')).toBe('Il a nonante ans, de mille neuf cent nonante à deux mille vingt-quatre.');
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
