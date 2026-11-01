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
export function audioHash(voice: string, text: string): Promise<string> {
  return textHash(`${voice}|${toBelgianSpeech(text)}`);
}
