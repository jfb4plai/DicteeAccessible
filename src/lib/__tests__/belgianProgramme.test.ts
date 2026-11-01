import { describe, it, expect } from 'vitest';
import { numbersToBelgianWords as n } from '../belgianNumbers';

// Tout ce qui peut apparaître dans une dictée du programme doit être lu à la belge : septante, nonante, quatre-vingts.

describe('grands nombres, groupes à espaces ou à points', () => {
  it.each([
    ['75 000', 'septante-cinq mille'],
    ['75 000', 'septante-cinq mille'],
    ['75 000', 'septante-cinq mille'],
    ['75.000', 'septante-cinq mille'],
    ['1 000', 'mille'],
    ['12 345', 'douze mille trois cent quarante-cinq'],
    ['91 000', 'nonante et un mille'],
    ['1 000 000', 'un million'],
    ['1000000', 'un million'],
    ['1.000.000', 'un million'],
    ['2 500 000', 'deux millions cinq cent mille'],
    ['80 000 000', 'quatre-vingts millions'],
    ['3 000 000 000', 'trois milliards'],
    ['1 250 000 000', 'un milliard deux cent cinquante millions'],
  ])('%s', (text, words) => {
    expect(n(text)).toBe(words);
  });
  it('laisse inchangé un nombre de plus de 12 chiffres', () => {
    expect(n('1 000 000 000 000')).toBe('1 000 000 000 000');
  });
});

describe('décimaux', () => {
  it.each([
    ['3,5', 'trois virgule cinq'],
    ['0,5', 'zéro virgule cinq'],
    ['1,70', 'un virgule septante'],
    ['2,90', 'deux virgule nonante'],
    ['1,05', 'un virgule zéro cinq'],
    ['2,000', 'deux virgule zéro zéro zéro'],
    ['3,14159', 'trois virgule un quatre un cinq neuf'],
    ['1 250,5', 'mille deux cent cinquante virgule cinq'],
  ])('%s', (text, words) => {
    expect(n(text)).toBe(words);
  });
  it('un point décimal isolé reste inchangé', () => {
    expect(n('3.5')).toBe('3.5');
  });
  it('une virgule de phrase après un nombre n\'est pas un décimal', () => {
    expect(n('Il a 90, elle a 80.')).toBe('Il a nonante, elle a quatre-vingts.');
  });
});

describe('euros et pourcentages', () => {
  it.each([
    ['1,70 €', 'un euro septante'],
    ['1,70€', 'un euro septante'],
    ['2,50 €', 'deux euros cinquante'],
    ['5 €', 'cinq euros'],
    ['1 €', 'un euro'],
    ['5,00 €', 'cinq euros'],
    ['0,50 €', 'zéro euro cinquante'],
    ['1 250 €', 'mille deux cent cinquante euros'],
    ['1.250,50 €', 'mille deux cent cinquante euros cinquante'],
    ['50 %', 'cinquante pour cent'],
    ['100%', 'cent pour cent'],
    ['12,5 %', 'douze virgule cinq pour cent'],
    ['90 %', 'nonante pour cent'],
  ])('%s', (text, words) => {
    expect(n(text)).toBe(words);
  });
  it('dans une phrase', () => {
    expect(n('Le pain coûte 1,70 € ce matin.')).toBe('Le pain coûte un euro septante ce matin.');
  });
});

describe('ordinaux', () => {
  it.each([
    ['1er', 'premier'], ['1re', 'première'], ['1ère', 'première'], ['1ers', 'premiers'],
    ['2e', 'deuxième'], ['2ème', 'deuxième'], ['2es', 'deuxièmes'], ['3e', 'troisième'], ['4e', 'quatrième'],
    ['5e', 'cinquième'], ['6e', 'sixième'], ['7e', 'septième'], ['9e', 'neuvième'], ['10e', 'dixième'], ['11e', 'onzième'],
    ['20e', 'vingtième'], ['21e', 'vingt et unième'], ['30e', 'trentième'],
    ['70e', 'septantième'], ['71e', 'septante et unième'], ['72e', 'septante-deuxième'],
    ['80e', 'quatre-vingtième'], ['81e', 'quatre-vingt-unième'],
    ['90e', 'nonantième'], ['91e', 'nonante et unième'], ['99e', 'nonante-neuvième'],
    ['100e', 'centième'], ['200e', 'deux centième'], ['1000e', 'millième'], ['2000e', 'deux millième'],
  ])('%s', (text, words) => {
    expect(n(text)).toBe(words);
  });
  it('dans une phrase', () => {
    expect(n('Le 71e jour de la 2e année.')).toBe('Le septante et unième jour de la deuxième année.');
  });
});

describe('périodes, dates et heures', () => {
  it.each([
    ['1990-2024', 'mille neuf cent nonante à deux mille vingt-quatre'],
    ['1914–1918', 'mille neuf cent quatorze à mille neuf cent dix-huit'],
    ['1914—1918', 'mille neuf cent quatorze à mille neuf cent dix-huit'],
    ['20-30', 'vingt à trente'],
    ['16/11/2024', 'seize novembre deux mille vingt-quatre'],
    ['1/2/2025', 'premier février deux mille vingt-cinq'],
    ['à 9 h 30', 'à neuf heures trente'],
    ['à 9h30', 'à neuf heures trente'],
    ['à 14 h 05', 'à quatorze heures cinq'],
    ['de 8 h à 10 h', 'de huit heures à dix heures'],
    ['à 1 h', 'à une heure'],
    ['à 21 h', 'à vingt et une heures'],
    ['à 10:30', 'à dix heures trente'],
    ['à 12 h 00', 'à douze heures'],
  ])('%s', (text, words) => {
    expect(n(text)).toBe(words);
  });
  it.each(['16/11', '1/2', '10:70', '25 h 70', '30/02/20245'])('laisse inchangé : %s', text => {
    expect(n(text)).toBe(text);
  });
});

describe('laissé tel quel', () => {
  it.each(['A4', '007', '3.5', 'Il a vingt ans.', 'pas de chiffre', ''])('%s', text => {
    expect(n(text)).toBe(text);
  });
});
