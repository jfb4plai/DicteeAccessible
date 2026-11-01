import { describe, it, expect } from 'vitest';
import { numbersToBelgianWords } from '../belgianNumbers';

const cases: [number, string][] = [
  [0, 'zéro'], [7, 'sept'], [16, 'seize'], [17, 'dix-sept'], [19, 'dix-neuf'],
  [20, 'vingt'], [21, 'vingt et un'], [22, 'vingt-deux'], [60, 'soixante'], [61, 'soixante et un'],
  [70, 'septante'], [71, 'septante et un'], [72, 'septante-deux'], [79, 'septante-neuf'],
  [80, 'quatre-vingts'], [81, 'quatre-vingt-un'], [82, 'quatre-vingt-deux'], [89, 'quatre-vingt-neuf'],
  [90, 'nonante'], [91, 'nonante et un'], [99, 'nonante-neuf'],
  [100, 'cent'], [101, 'cent un'], [170, 'cent septante'], [180, 'cent quatre-vingts'], [190, 'cent nonante'],
  [200, 'deux cents'], [201, 'deux cent un'], [280, 'deux cent quatre-vingts'], [999, 'neuf cent nonante-neuf'],
  [1000, 'mille'], [1001, 'mille un'], [1990, 'mille neuf cent nonante'], [2000, 'deux mille'],
  [2024, 'deux mille vingt-quatre'], [21000, 'vingt et un mille'], [80000, 'quatre-vingt mille'],
  [200000, 'deux cent mille'], [999999, 'neuf cent nonante-neuf mille neuf cent nonante-neuf'],
];

describe('numbersToBelgianWords : nombres isolés', () => {
  it.each(cases)('%i', (n, words) => {
    expect(numbersToBelgianWords(String(n))).toBe(words);
  });
});

describe('numbersToBelgianWords : dans une phrase', () => {
  it('remplace le nombre et garde le reste', () => {
    expect(numbersToBelgianWords('Il a 90 ans.')).toBe('Il a nonante ans.');
  });
  it('remplace plusieurs nombres', () => {
    expect(numbersToBelgianWords('70 et 90')).toBe('septante et nonante');
  });
  it('un nombre suivi d\'une virgule de phrase est converti', () => {
    expect(numbersToBelgianWords('En 1990, il neigeait.')).toBe('En mille neuf cent nonante, il neigeait.');
  });
  it('un nombre en fin de phrase avec un point est converti', () => {
    expect(numbersToBelgianWords('Il y a 80.')).toBe('Il y a quatre-vingts.');
  });
});

describe('numbersToBelgianWords : laissé tel quel', () => {
  it.each(['A4', '007', 'Il a vingt ans.', '', 'pas de chiffre'])('%s', text => {
    expect(numbersToBelgianWords(text)).toBe(text);
  });
});
