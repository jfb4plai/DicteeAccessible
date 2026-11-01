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
