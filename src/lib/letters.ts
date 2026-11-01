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

export function buildLetterPool(word: string, rng: () => number = Math.random): string[] {
  const letters = word.split('').filter(char => !PREFILLED_CHARS.includes(char));
  return shuffleArray(letters, rng);
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
