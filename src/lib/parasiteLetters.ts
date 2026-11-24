import { shuffleArray } from './utils';

// Lettres en trop ajoutées aux tuiles d'une dictée de mots. Choisies par le programme (tables ci-dessous), jamais par l'IA.
export const LETTER_PROXIMITIES = ['none', 'phonetic', 'spelling', 'both'] as const;
export type LetterProximity = (typeof LETTER_PROXIMITIES)[number];
export const MAX_PARASITE_LETTERS = 3;

export function parseLetterProximity(v: unknown): LetterProximity {
  return LETTER_PROXIMITIES.find(p => p === v) ?? 'none';
}

export function clampLetterCount(n: unknown): number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? Math.min(n, MAX_PARASITE_LETTERS) : 0;
}

// Lettres qui se ressemblent à l'oreille (c/k/q, s/z, g/j, f/v, t/d, p/b, é/è/ê/e, i/y…).
const SOUND_GROUPS = ['ckqs', 'szcxç', 'gj', 'fv', 'td', 'pb', 'mn', 'eéèêë', 'iy', 'wvu', 'oôò', 'aàâ'];
// Lettres qui se ressemblent à l'œil (b/d/p/q, m/n/u/h, a/o/e/c, i/j/l/t/f, g/q/y, v/w/u…).
const LOOK_GROUPS = ['bdpq', 'mnuh', 'aoec', 'ijltf', 'gqy', 'vwu', 'eéèêë', 'cç', 'aàâ', 'oô', 'iî', 'uûù'];

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

const norm = (c: string) => c.normalize('NFC').toLowerCase();

function closeTo(letter: string, groups: string[]): Set<string> {
  const out = new Set<string>();
  for (const g of groups) if (g.includes(letter)) for (const c of g) if (c !== letter) out.add(c);
  return out;
}

// Lettres proches de `letter` selon le choix : par le son, par l'écriture, ou les deux (celles qui sont dans les deux d'abord).
export function closeLetters(letter: string, proximity: LetterProximity): string[] {
  const l = norm(letter);
  if (proximity === 'none') return [];
  const sound = closeTo(l, SOUND_GROUPS);
  const look = closeTo(l, LOOK_GROUPS);
  if (proximity === 'phonetic') return [...sound];
  if (proximity === 'spelling') return [...look];
  const both = [...sound].filter(c => look.has(c));
  const rest = [...new Set([...sound, ...look])].filter(c => !both.includes(c));
  return [...both, ...rest];
}

// `count` lettres absentes du mot (une lettre en trop ne peut donc pas passer pour une lettre juste), proches des lettres du mot
// selon `proximity` ; si les proches ne suffisent pas, complétées par d'autres lettres de l'alphabet absentes du mot.
export function pickParasiteLetters(word: string, count: number, proximity: LetterProximity, rng: () => number = Math.random): string[] {
  const n = clampLetterCount(count);
  if (n === 0) return [];
  const inWord = new Set(word.split('').map(norm));
  const chosen: string[] = [];
  const take = (c: string) => { if (!inWord.has(c) && !chosen.includes(c) && chosen.length < n) chosen.push(c); };

  const wordLetters = shuffleArray([...inWord].filter(c => /\p{L}/u.test(c)), rng);
  // Un tour par lettre du mot, pour varier les lettres de départ, en gardant l'ordre de proximité de chacune.
  const candidates = wordLetters.map(l => closeLetters(l, proximity));
  for (let round = 0; chosen.length < n && round < 6; round++) {
    for (const list of candidates) if (list[round] !== undefined) take(list[round]);
  }
  for (const c of shuffleArray(ALPHABET, rng)) take(c);
  return chosen;
}
