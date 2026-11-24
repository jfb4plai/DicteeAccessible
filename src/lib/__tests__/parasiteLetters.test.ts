import { describe, it, expect } from 'vitest';
import { buildLetterPool } from '../letters';
import { clampLetterCount, closeLetters, parseLetterProximity, pickParasiteLetters } from '../parasiteLetters';
import { createExercise, exerciseReducer } from '../letterExercise';

const fixed = () => 0.5;

describe('closeLetters', () => {
  it('par le son : c proche de k, q, s ; s proche de z', () => {
    expect(closeLetters('c', 'phonetic')).toEqual(expect.arrayContaining(['k', 'q', 's']));
    expect(closeLetters('s', 'phonetic')).toContain('z');
  });
  it('par l\'écriture : b proche de d, p, q ; m proche de n et u', () => {
    expect(closeLetters('b', 'spelling')).toEqual(expect.arrayContaining(['d', 'p', 'q']));
    expect(closeLetters('m', 'spelling')).toEqual(expect.arrayContaining(['n', 'u']));
  });
  it('les deux : les lettres proches par le son ET par l\'écriture passent en premier', () => {
    const both = closeLetters('m', 'both');
    expect(both[0]).toBe('n'); // m/n : même son proche et même forme proche
  });
  it('sans consigne, ou lettre inconnue : aucune lettre proche', () => {
    expect(closeLetters('b', 'none')).toEqual([]);
    expect(closeLetters('#', 'both')).toEqual([]);
  });
  it('é est proche de e, è, ê', () => {
    expect(closeLetters('é', 'spelling')).toEqual(expect.arrayContaining(['e', 'è', 'ê']));
  });
});

describe('pickParasiteLetters', () => {
  it('0 lettre : aucune', () => {
    expect(pickParasiteLetters('chat', 0, 'both')).toEqual([]);
  });
  it('donne le nombre demandé, sans doublon, jamais une lettre du mot', () => {
    for (const prox of ['none', 'phonetic', 'spelling', 'both'] as const) {
      for (const n of [1, 2, 3]) {
        const got = pickParasiteLetters('chat', n, prox, Math.random);
        expect(got).toHaveLength(n);
        expect(new Set(got).size).toBe(n);
        for (const l of got) expect('chat'.includes(l)).toBe(false);
      }
    }
  });
  it('par l\'écriture, un mot avec b reçoit en priorité d, p ou q', () => {
    const got = pickParasiteLetters('bu', 2, 'spelling', fixed);
    expect(got.some(l => 'dpq'.includes(l) || 'nmh'.includes(l))).toBe(true);
  });
  it('plafonne à 3, ignore les valeurs absurdes', () => {
    expect(pickParasiteLetters('chat', 9, 'none')).toHaveLength(3);
    expect(pickParasiteLetters('chat', -2, 'none')).toEqual([]);
  });
  it('mot qui contient presque tout l\'alphabet : moins de lettres plutôt qu\'une lettre du mot', () => {
    const word = 'abcdefghijklmnopqrstuvwxy';
    const got = pickParasiteLetters(word, 3, 'none');
    expect(got).toEqual(['z']);
  });
  it('majuscules et accents du mot sont comptés comme présents', () => {
    const got = pickParasiteLetters('Éé', 3, 'spelling', fixed);
    expect(got).toHaveLength(3);
    expect(got).not.toContain('é');
  });
});

describe('clampLetterCount / parseLetterProximity', () => {
  it('valeurs sûres par défaut', () => {
    expect(clampLetterCount(2)).toBe(2);
    expect(clampLetterCount(7)).toBe(3);
    expect(clampLetterCount(undefined)).toBe(0);
    expect(parseLetterProximity('both')).toBe('both');
    expect(parseLetterProximity('x')).toBe('none');
  });
});

describe('tuiles avec lettres en trop', () => {
  it('buildLetterPool ajoute les lettres en trop aux lettres du mot', () => {
    const pool = buildLetterPool('chat', fixed, ['k', 's']);
    expect([...pool].sort()).toEqual(['a', 'c', 'h', 'k', 's', 't']);
  });
  it('sans lettre en trop : comportement inchangé', () => {
    expect([...buildLetterPool('chat', fixed)].sort()).toEqual(['a', 'c', 'h', 't']);
  });
  it('la dictée reste réussissable : les lettres en trop restent dans le réservoir', () => {
    let s = createExercise('chat', fixed, ['k', 's']);
    expect(s.pool).toHaveLength(6);
    for (const l of ['c', 'h', 'a', 't']) {
      s = exerciseReducer(s, { type: 'place', poolIndex: s.pool.indexOf(l) });
    }
    expect(s.phase).toBe('ready');
    s = exerciseReducer(s, { type: 'validate' });
    expect(s.phase).toBe('right');
    expect(s.pool.sort()).toEqual(['k', 's']);
  });
  it('après une erreur, « Réessayer » garde les mêmes lettres en trop', () => {
    let s = createExercise('chat', fixed, ['k', 's']);
    for (const l of ['h', 'c', 'a', 't']) s = exerciseReducer(s, { type: 'place', poolIndex: s.pool.indexOf(l) });
    s = exerciseReducer(s, { type: 'validate' });
    expect(s.phase).toBe('wrong');
    s = exerciseReducer(s, { type: 'retry' });
    expect([...s.pool].sort()).toEqual(['a', 'c', 'h', 'k', 's', 't']);
  });
});
