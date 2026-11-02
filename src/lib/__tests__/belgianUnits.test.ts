import { describe, it, expect } from 'vitest';
import { numbersToBelgianWords as n } from '../belgianNumbers';

// Unités du programme : le nombre est lu à la belge et l'unité en toutes lettres (pluriel si la valeur est 2 ou plus).

describe('unités de mesure', () => {
  it.each([
    ['5 km', 'cinq kilomètres'],
    ['5km', 'cinq kilomètres'],
    ['1 km', 'un kilomètre'],
    ['70 km', 'septante kilomètres'],
    ['90 cm', 'nonante centimètres'],
    ['1,5 km', 'un virgule cinq kilomètre'],
    ['2,5 km', 'deux virgule cinq kilomètres'],
    ['0,5 kg', 'zéro virgule cinq kilogramme'],
    ['250 g', 'deux cent cinquante grammes'],
    ['3 mm', 'trois millimètres'],
    ['4 m', 'quatre mètres'],
    ['2 dm', 'deux décimètres'],
    ['2 dam', 'deux décamètres'],
    ['2 hm', 'deux hectomètres'],
    ['1,5 l', 'un virgule cinq litre'],
    ['75 cl', 'septante-cinq centilitres'],
    ['2 dl', 'deux décilitres'],
    ['33 ml', 'trente-trois millilitres'],
    ['3 t', 'trois tonnes'],
    ['5 mg', 'cinq milligrammes'],
    ['9 m²', 'neuf mètres carrés'],
    ['9 cm²', 'neuf centimètres carrés'],
    ['2 m³', 'deux mètres cubes'],
    ['80 km/h', 'quatre-vingts kilomètres à l\'heure'],
    ['1 000 km', 'mille kilomètres'],
    ['20 °C', 'vingt degrés Celsius'],
    ['1 °C', 'un degré Celsius'],
    ['-5 °C', '-cinq degrés Celsius'],
  ])('%s', (text, words) => {
    expect(n(text)).toBe(words);
  });
  it('dans une phrase', () => {
    expect(n('Il court 5 km en 90 min.')).toBe('Il court cinq kilomètres en nonante minutes.');
  });
  it('un mot qui commence comme une unité reste inchangé', () => {
    expect(n('5 mètres')).toBe('cinq mètres');
    expect(n('3 gommes')).toBe('trois gommes');
    expect(n('4 kilos')).toBe('quatre kilos');
  });
  it('minutes et secondes abrégées', () => {
    expect(n('10 min')).toBe('dix minutes');
    expect(n('1 min')).toBe('une minute');
    expect(n('30 s')).toBe('trente secondes');
  });
});
