import { shuffleArray } from './utils';

const PREFILLED_CHARS = ['-', "'", '’', ' '];

function normalize(text: string): string {
  return text.normalize('NFC').toLowerCase();
}

export function isCorrectAnswer(answer: string, expected: string): boolean {
  return normalize(answer) === normalize(expected);
}

export function autoPrefilledIndices(word: string): number[] {
  const indices: number[] = [];
  word.split('').forEach((char, i) => {
    if (PREFILLED_CHARS.includes(char)) indices.push(i);
  });
  return indices;
}

// extras : lettres en trop (parasites) mêlées aux lettres du mot ; elles ne servent pas à écrire le mot.
export function buildLetterPool(word: string, rng: () => number = Math.random, extras: string[] = []): string[] {
  const letters = word.split('').filter(char => !PREFILLED_CHARS.includes(char));
  return shuffleArray([...letters, ...extras], rng);
}

export function wrongPositions(placed: (string | null)[], expected: string): number[] {
  const wanted = normalize(expected).split('');
  const wrong: number[] = [];
  wanted.forEach((char, i) => {
    const got = placed[i];
    if (got === null || got === undefined || normalize(got) !== char) wrong.push(i);
  });
  return wrong;
}
