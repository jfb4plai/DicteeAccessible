import { LEXICON } from './belgianLexicon.js';
import { numbersToBelgianWords } from './belgianNumbers.js';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function matchCase(source: string, replacement: string): string {
  if (source.length > 1 && source === source.toUpperCase()) return replacement.toUpperCase();
  if (/^\p{Lu}/u.test(source)) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  return replacement;
}

// Mots entiers, insensible à la casse, majuscule initiale conservée. « wagon-lit » est reconnu : le trait d'union borne le mot.
export function applyLexicon(text: string, lexicon: Record<string, string> = LEXICON): string {
  const keys = Object.keys(lexicon).sort((a, b) => b.length - a.length);
  if (keys.length === 0 || !text) return text;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${keys.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  return text.replace(pattern, match => matchCase(match, lexicon[match.toLowerCase()]));
}

// Texte envoyé à la synthèse vocale : nombres en lettres belges, puis lexique belge.
export function toBelgianSpeech(text: string): string {
  return applyLexicon(numbersToBelgianWords(text));
}
