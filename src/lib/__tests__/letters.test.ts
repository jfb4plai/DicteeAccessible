import { describe, it, expect } from 'vitest';
import { isCorrectAnswer, autoPrefilledIndices, buildLetterPool, wrongPositions } from '../letters';

describe('isCorrectAnswer', () => {
  it('ignore la casse', () => expect(isCorrectAnswer('Lendemain', 'lendemain')).toBe(true));
  it('refuse une faute', () => expect(isCorrectAnswer('lendemin', 'lendemain')).toBe(false));
  it('accepte un accent décomposé', () => expect(isCorrectAnswer('été', 'été')).toBe(true));
});

describe('autoPrefilledIndices', () => {
  it('apostrophe droite', () => expect(autoPrefilledIndices("aujourd'hui")).toEqual([7]));
  it('apostrophe typographique', () => expect(autoPrefilledIndices('aujourd’hui')).toEqual([7]));
  it('trait d\'union', () => expect(autoPrefilledIndices('peut-être')).toEqual([4]));
  it('espaces', () => expect(autoPrefilledIndices('pomme de terre')).toEqual([5, 8]));
});

describe('buildLetterPool', () => {
  it('garde les lettres en double', () => {
    expect([...buildLetterPool('été')].sort()).toEqual(['t', 'é', 'é'].sort());
  });
  it('exclut les caractères préremplis', () => {
    expect(buildLetterPool('peut-être').length).toBe(8);
  });
});

describe('wrongPositions', () => {
  it('compte une case vide comme fausse', () => {
    expect(wrongPositions(['l', 'e', 'n', null], 'lend')).toEqual([3]);
  });
  it('repère la lettre fausse', () => {
    expect(wrongPositions(['l', 'e', 'x', 'd'], 'lend')).toEqual([2]);
  });
});
