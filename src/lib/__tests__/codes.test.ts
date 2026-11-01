import { describe, it, expect } from 'vitest';
import { generateAccessCode, nextPupilCodes } from '../codes';

describe('nextPupilCodes', () => {
  it('continue après le plus grand numéro existant', () => {
    expect(nextPupilCodes(['E1', 'E3'], 2)).toEqual(['E4', 'E5']);
  });
  it('commence à E1 sans code existant', () => {
    expect(nextPupilCodes([], 3)).toEqual(['E1', 'E2', 'E3']);
  });
});

describe('generateAccessCode', () => {
  it('utilise le premier caractère de l\'alphabet quand le tirage vaut 0', () => {
    expect(generateAccessCode(() => 0)).toBe('AAAAAA');
  });
  it('produit 6 caractères sans O, 0, I, 1', () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateAccessCode();
      expect(code).toHaveLength(6);
      expect(code).not.toMatch(/[O0I1]/);
    }
  });
});
