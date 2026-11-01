import { normalizeCode } from './apiMapping';

// URL de l'audio d'un mot ou d'une phrase : seulement des identifiants, jamais de texte ni de code élève.
// L'empreinte du texte change quand l'enseignant(e) modifie la phrase, donc le cache ne sert jamais un ancien audio.
export function buildSpeakUrl(a: { accessCode: string; kind: 'word' | 'sentence'; id: string; hash: string }): string {
  const q = new URLSearchParams({ session: normalizeCode(a.accessCode), kind: a.kind, id: a.id, h: a.hash });
  return `/api/speak?${q.toString()}`;
}
