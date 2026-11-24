import { toBelgianSpeech } from './belgianSpeech.js';

// Empreinte courte d'un texte (SHA-256, 16 premiers caractères hexadécimaux), identique côté navigateur et serveur.
// Elle fait changer l'URL de l'audio quand l'enseignant(e) modifie le texte, donc le cache ne sert jamais un ancien audio.
export async function textHash(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text.normalize('NFC'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

// Empreinte portée par l'URL de l'audio : voix + texte tel qu'il est envoyé à la synthèse (nombres et lexique belges appliqués).
// Une voix changée, un lexique ou une règle de nombres corrigés produisent une autre URL : le cache d'un an ne sert jamais l'ancien audio.
// Un mot seul n'a aucun contexte : la voix le prend parfois pour de l'anglais (vent, froid) ou du russe (fort). Pour les MOTS, la
// synthèse reçoit donc un texte d'amorce non lu (previous_text) qui l'oriente vers le français ; essai validé à l'oreille par JF
// le 2026-11-24 sur « fort ». Le marqueur de version change l'empreinte des mots : l'ancien audio en cache n'est plus servi.
export const WORD_CONTEXT_TEXT = 'Écris ce mot en français : ';
const WORD_CONTEXT_VERSION = 'ctx1';

export type SpeakKind = 'word' | 'sentence';

export function audioHash(voice: string, text: string, kind: SpeakKind = 'sentence'): Promise<string> {
  const base = `${voice}|${toBelgianSpeech(text)}`;
  return textHash(kind === 'word' ? `${base}|${WORD_CONTEXT_VERSION}` : base);
}
