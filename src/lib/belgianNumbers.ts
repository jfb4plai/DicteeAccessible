// Nombres en lettres, français de Belgique : 70 « septante », 90 « nonante », 80 « quatre-vingts ».
// Sert uniquement au texte envoyé à la synthèse vocale : le texte affiché à l'élève n'est jamais modifié.

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];
const TENS: Record<number, string> = {
  2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante', 7: 'septante', 9: 'nonante',
};

// `final` : aucun mot ne suit le nombre, donc « quatre-vingts » et « cents » prennent leur « s ».
function below100(n: number, final: boolean): string {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 8) {
    if (u === 0) return final ? 'quatre-vingts' : 'quatre-vingt';
    return `quatre-vingt-${UNITS[u]}`;
  }
  const base = TENS[t];
  if (u === 0) return base;
  if (u === 1) return `${base} et un`;
  return `${base}-${UNITS[u]}`;
}

function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return below100(n, final);
  const hundred = h === 1 ? 'cent' : `${UNITS[h]} cent`;
  if (r === 0) return h > 1 && final ? `${hundred}s` : hundred;
  return `${hundred} ${below100(r, final)}`;
}

function toWords(n: number): string {
  if (n < 1000) return below1000(n, true);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = thousands === 1 ? 'mille' : `${below1000(thousands, false)} mille`;
  return rest === 0 ? head : `${head} ${below1000(rest, true)}`;
}

// Groupes à espaces (« 1 000 ») : hors portée, laissés tels quels. Entiers isolés de 1 à 6 chiffres : convertis.
const NUMBER = /(\d{1,3}(?:[   ]\d{3})+)|(?<![\p{L}\p{N}.,])(\d{1,6})(?![\p{L}\p{N}]|[.,]\d)/gu;

export function numbersToBelgianWords(text: string): string {
  return text.replace(NUMBER, (match, group: string | undefined, digits: string | undefined) => {
    if (group || !digits) return match;
    if (digits.length > 1 && digits.startsWith('0')) return match;
    return toWords(Number(digits));
  });
}
