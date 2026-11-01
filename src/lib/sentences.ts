import { shuffleArray } from './utils.js';
import type { AttemptRow, DictaItem, DictaSentence } from './types';

const EDGE = /^[.,;:!?«»"()[\]…\s]+|[.,;:!?«»"()[\]…\s]+$/g;
const MAX_PARASITES = 4;
const MAX_WORDS: Record<string, number> = { P1: 6, P2: 8, P3: 10, P4: 12, P5: 14, P6: 16 };

// Comparaison : forme composée, minuscules, une seule apostrophe.
export function normalizeToken(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/’/g, "'");
}

export function tokenizeSentence(text: string): string[] {
  return text.normalize('NFC').split(/\s+/).filter(Boolean);
}

export function stripPunctuation(token: string): string {
  return token.replace(EDGE, '');
}

const cleanTokens = (text: string): string[] =>
  tokenizeSentence(text).map(t => normalizeToken(stripPunctuation(t))).filter(Boolean);

export function containsWord(sentence: string, word: string): boolean {
  const s = cleanTokens(sentence);
  const w = cleanTokens(word);
  if (w.length === 0) return false;
  for (let i = 0; i + w.length <= s.length; i++) {
    if (w.every((tok, j) => s[i + j] === tok)) return true;
  }
  return false;
}

export function filterParasites(sentence: string, parasites: string[]): { kept: string[]; removed: string[] } {
  const inSentence = new Set(cleanTokens(sentence));
  const seen = new Set<string>();
  const kept: string[] = [];
  const removed: string[] = [];
  for (const raw of parasites) {
    const clean = raw.trim();
    const key = normalizeToken(stripPunctuation(clean));
    if (!key) continue;
    if (inSentence.has(key) || seen.has(key) || kept.length >= MAX_PARASITES) {
      removed.push(raw);
    } else {
      seen.add(key);
      kept.push(clean);
    }
  }
  return { kept, removed };
}

export function isCorrectSentenceAnswer(answerTokens: string[], sentence: string): boolean {
  const expected = tokenizeSentence(sentence).map(normalizeToken);
  const given = answerTokens.map(normalizeToken);
  return expected.length === given.length && expected.every((tok, i) => tok === given[i]);
}

export type SentenceTile = { id: string; text: string; parasite: boolean };

export function buildSentenceTiles(
  s: { text: string; parasites: string[] },
  rng: () => number = Math.random,
): SentenceTile[] {
  const tokens: SentenceTile[] = tokenizeSentence(s.text).map((text, i) => ({ id: `t${i}`, text, parasite: false }));
  const parasites: SentenceTile[] = s.parasites.map((text, i) => ({ id: `p${i}`, text, parasite: true }));
  return shuffleArray([...tokens, ...parasites], rng);
}

// Une phrase n'est proposée que si chaque mot de la liste qu'elle contient a une réponse juste à l'étape A.
export function sentenceUnlocked(sentence: DictaSentence, items: DictaItem[], rows: AttemptRow[]): boolean {
  return items
    .filter(item => containsWord(sentence.text, item.word))
    .every(item => rows.some(r => r.itemId === item.id && r.stage === 'A' && r.kind === 'attempt' && r.correct === true));
}

export function maxWords(level: string): number {
  return MAX_WORDS[level] ?? MAX_WORDS.P6;
}

export function sentenceTooLong(text: string, level: string): boolean {
  return cleanTokens(text).length > maxWords(level);
}

// B1 : phrase visible, on ne fait que l'ordonner (aucun mot en trop). B2 : les parasites s'ajoutent aux tuiles.
export function sentenceForStage(
  s: { text: string; parasites: string[] },
  stage: 'B1' | 'B2',
): { text: string; parasites: string[] } {
  return { text: s.text, parasites: stage === 'B1' ? [] : s.parasites };
}
