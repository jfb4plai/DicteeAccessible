// Jeton : 32 octets en base64url sans « = », soit 43 caractères. Même forme que dicta_share_create côté SQL.
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// Le jeton est dans le fragment (#t=…) : il n'est ni envoyé au serveur, ni transmis dans le Referer.
export function buildShareUrl(origin: string, token: string): string {
  return `${origin}/suivi#t=${token}`;
}

export function parseShareToken(hash: string): string | null {
  const m = /^#t=(.+)$/.exec(hash);
  return m && TOKEN_PATTERN.test(m[1]) ? m[1] : null;
}

// Fin de l'année scolaire : le 31 août à 23 h 59 min 59 s, celui de l'année en cours ou, après le 31 août, du suivant.
export function defaultShareExpiry(now: Date): Date {
  const afterAugust = now.getMonth() > 7;
  return new Date(now.getFullYear() + (afterAugust ? 1 : 0), 7, 31, 23, 59, 59);
}

// Texte neutre : ni code ni prénom d'élève. L'app n'envoie rien, l'enseignant(e) complète le destinataire.
export function buildInviteMailto(url: string, label: string): string {
  const subject = 'Accès en lecture seule aux résultats de dictée';
  const body = [
    `Bonjour (${label}),`,
    '',
    "Voici un lien personnel pour consulter, en lecture seule, les résultats de dictée d'un élève :",
    url,
    '',
    'Les résultats sont une information, pas une note. Ce lien est un secret : ne le transmettez pas.',
    "Je peux le retirer à tout moment.",
  ].join('\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
