import { describe, it, expect } from 'vitest';
import { applyLexicon, toBelgianSpeech } from '../belgianSpeech';

describe('applyLexicon', () => {
  it.each([
    ['Un wagon.', 'Un ouagon.'],
    ['Wagons', 'Ouagons'],
    ['La Wallonie.', 'La Ouallonie.'],
    ['Un wallon, une wallonne.', 'Un ouallon, une ouallonne.'],
    ['Des wallons et des wallonnes', 'Des ouallons et des ouallonnes'],
    ['wagon-lit', 'ouagon-lit'],
    ['« Le wagon »', '« Le ouagon »'],
  ])('%s', (input, expected) => {
    expect(applyLexicon(input)).toBe(expected);
  });

  it.each(['kiwi', 'swagger', 'wagonnet', 'Il joue au chat.', ''])('laisse inchangé : %s', text => {
    expect(applyLexicon(text)).toBe(text);
  });

  it('accepte un lexique fourni', () => {
    expect(applyLexicon('Un week-end', { 'week-end': 'ouiquènd' })).toBe('Un ouiquènd');
  });
});

describe('toBelgianSpeech', () => {
  it('convertit les nombres puis le lexique', () => {
    expect(toBelgianSpeech('Il a 90 ans, un wagon.')).toBe('Il a nonante ans, un ouagon.');
  });
  it('laisse inchangée une phrase ordinaire', () => {
    expect(toBelgianSpeech('Le vent a soufflé fort.')).toBe('Le vent a soufflé fort.');
  });
  it('texte vide', () => {
    expect(toBelgianSpeech('')).toBe('');
  });
});
