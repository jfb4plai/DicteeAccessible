import { describe, it, expect } from 'vitest';
import {
  tokenizeSentence, stripPunctuation, containsWord, filterParasites, isCorrectSentenceAnswer,
  buildSentenceTiles, sentenceUnlocked, maxWords, sentenceTooLong,
} from '../sentences';
import type { AttemptRow, DictaItem, DictaSentence } from '../types';

describe('tokenizeSentence', () => {
  it('coupe sur les espaces et garde la ponctuation collée', () => {
    expect(tokenizeSentence('  Le vent  a soufflé fort. ')).toEqual(['Le', 'vent', 'a', 'soufflé', 'fort.']);
  });
  it('garde l\'apostrophe typographique dans le jeton', () => {
    expect(tokenizeSentence('L’été est là.')).toEqual(['L’été', 'est', 'là.']);
  });
});

describe('stripPunctuation', () => {
  it('retire la ponctuation aux extrémités seulement', () => {
    expect(stripPunctuation('fort.')).toBe('fort');
    expect(stripPunctuation('«peut-être,»')).toBe('peut-être');
    expect(stripPunctuation("aujourd'hui")).toBe("aujourd'hui");
  });
});

describe('containsWord', () => {
  it('trouve un mot de la phrase', () => expect(containsWord('Le vent a soufflé fort.', 'fort')).toBe(true));
  it('refuse une autre forme du verbe', () => expect(containsWord('Le vent a soufflé fort.', 'souffler')).toBe(false));
  it('ignore la ponctuation et garde le trait d\'union', () => {
    expect(containsWord("Il boit, peut-être, de l'eau.", 'peut-être')).toBe(true);
  });
  it('trouve un mot à plusieurs jetons', () => {
    expect(containsWord('Il mange une pomme de terre.', 'pomme de terre')).toBe(true);
  });
  it('ignore la casse', () => expect(containsWord('Été chaud.', 'été')).toBe(true));
});

describe('filterParasites', () => {
  it('retire les parasites égaux à un mot de la phrase, les doublons et garde 4 au plus', () => {
    const r = filterParasites('Le vent a soufflé fort.', ['souffler', 'soufflez', 'soufflé', 'Fort', 'souffler']);
    expect(r.kept).toEqual(['souffler', 'soufflez']);
    expect(r.removed).toEqual(['soufflé', 'Fort', 'souffler']);
  });
  it('limite à 4 parasites', () => {
    const r = filterParasites('Le chat dort.', ['a', 'b', 'c', 'd', 'e']);
    expect(r.kept).toEqual(['a', 'b', 'c', 'd']);
    expect(r.removed).toEqual(['e']);
  });
});

describe('isCorrectSentenceAnswer', () => {
  const s = 'Le vent a soufflé fort.';
  it('accepte la bonne suite', () => expect(isCorrectSentenceAnswer(['Le', 'vent', 'a', 'soufflé', 'fort.'], s)).toBe(true));
  it('refuse deux jetons échangés', () => expect(isCorrectSentenceAnswer(['vent', 'Le', 'a', 'soufflé', 'fort.'], s)).toBe(false));
  it('ignore la casse', () => expect(isCorrectSentenceAnswer(['le', 'vent', 'a', 'soufflé', 'fort.'], s)).toBe(true));
  it('traite pareil les deux apostrophes', () => {
    expect(isCorrectSentenceAnswer(["L'été", 'est', 'là.'], 'L’été est là.')).toBe(true);
  });
  it('refuse un jeton en trop ou en moins', () => {
    expect(isCorrectSentenceAnswer(['Le', 'vent', 'a', 'soufflé'], s)).toBe(false);
  });
});

describe('buildSentenceTiles', () => {
  it('ajoute les parasites aux jetons avec des identifiants uniques', () => {
    const tiles = buildSentenceTiles({ text: 'Le vent a soufflé fort.', parasites: ['souffler', 'soufflez'] });
    expect(tiles).toHaveLength(7);
    expect(tiles.filter(t => t.parasite)).toHaveLength(2);
    expect(new Set(tiles.map(t => t.id)).size).toBe(7);
  });
});

describe('sentenceUnlocked', () => {
  const items: DictaItem[] = [
    { id: 'i1', word: 'soufflé', position: 0 },
    { id: 'i2', word: 'maison', position: 1 },
  ];
  const sentence: DictaSentence = { id: 's1', position: 0, text: 'Le vent a soufflé fort.', parasites: [], itemId: null };
  const okA: AttemptRow = { itemId: 'i1', stage: 'A', kind: 'attempt', attemptNumber: 1, correct: true };

  it('verrouillée tant que le mot de la phrase n\'a pas de réponse A juste', () => {
    expect(sentenceUnlocked(sentence, items, [])).toBe(false);
  });
  it('déverrouillée après une réponse A juste, sans tenir compte des mots absents de la phrase', () => {
    expect(sentenceUnlocked(sentence, items, [okA])).toBe(true);
  });
  it('déverrouillée quand aucun mot de la liste n\'apparaît dans la phrase', () => {
    expect(sentenceUnlocked({ ...sentence, text: 'Il pleut.' }, items, [])).toBe(true);
  });
});

describe('longueur', () => {
  it('maxWords par niveau', () => {
    expect([maxWords('P1'), maxWords('P3'), maxWords('P6')]).toEqual([6, 10, 16]);
  });
  it('sentenceTooLong', () => {
    expect(sentenceTooLong('Le vent a soufflé très fort sur la colline hier soir.', 'P1')).toBe(true);
    expect(sentenceTooLong('Le vent a soufflé fort.', 'P1')).toBe(false);
  });
});
