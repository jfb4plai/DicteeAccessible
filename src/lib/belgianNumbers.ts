// Nombres, décimaux, euros, pourcentages, ordinaux, périodes, dates et heures en lettres, français de Belgique :
// 70 « septante », 90 « nonante », 80 « quatre-vingts ». Pour ces élèves, la lecture doit être conforme au programme.
// Sert uniquement au texte envoyé à la synthèse vocale : le texte affiché à l'élève n'est jamais modifié.
// Pas de lookbehind : certaines tablettes (iOS avant 16.4) refusent de charger un fichier qui en contient ;
// le caractère précédent est capturé puis remis (groupe `prefix`).

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];
const TENS: Record<number, string> = {
  2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante', 7: 'septante', 9: 'nonante',
};
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MAX_DIGITS = 12;

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

function below1e6(n: number): string {
  if (n < 1000) return below1000(n, true);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = thousands === 1 ? 'mille' : `${below1000(thousands, false)} mille`;
  return rest === 0 ? head : `${head} ${below1000(rest, true)}`;
}

// 0 à 999 999 999 999. « million » et « milliard » sont des noms : « deux millions », « quatre-vingts millions ».
function cardinal(n: number): string {
  if (n < 1e6) return below1e6(n);
  const billions = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const rest = n % 1e6;
  const parts: string[] = [];
  if (billions) parts.push(billions === 1 ? 'un milliard' : `${below1000(billions, true)} milliards`);
  if (millions) parts.push(millions === 1 ? 'un million' : `${below1000(millions, true)} millions`);
  if (rest) parts.push(below1e6(rest));
  return parts.join(' ');
}

// Féminin pour les heures : « vingt et une heures ».
const feminine = (words: string) => words.replace(/\bun$/, 'une');

function ordinal(n: number, fem: boolean, plural: boolean): string {
  const s = plural ? 's' : '';
  if (n === 1) return (fem ? 'première' : 'premier') + s;
  const words = cardinal(n);
  const last = /\p{L}+$/u.exec(words)![0];
  const head = words.slice(0, words.length - last.length);
  let stem: string;
  if (last === 'un') stem = 'un';
  else if (last === 'cinq') stem = 'cinqu';
  else if (last === 'neuf') stem = 'neuv';
  else if (['vingts', 'cents', 'millions', 'milliards'].includes(last)) stem = last.slice(0, -1);
  else if (last.endsWith('e')) stem = last.slice(0, -1);
  else stem = last;
  return `${head}${stem}ième${s}`;
}

const intOf = (digits: string) => Number(digits.replace(/[ .  ]/g, ''));

function decimalWords(d: string): string {
  if (d.length > 3) return [...d].map(c => UNITS[Number(c)]).join(' ');
  const zeros = d.length - d.replace(/^0+/, '').length;
  const rest = d.slice(zeros);
  const lead = Array(zeros).fill('zéro').join(' ');
  return rest === '' ? lead : `${lead ? `${lead} ` : ''}${cardinal(Number(rest))}`;
}

function clock(h: number, m: number): string {
  const hours = h === 1 ? 'une heure' : h === 0 ? 'zéro heure' : `${feminine(cardinal(h))} heures`;
  return m === 0 ? hours : `${hours} ${cardinal(m)}`;
}

// Abréviation → [singulier, pluriel]. Le nombre reste en chiffres ici : les passes suivantes le lisent à la belge.
const UNIT_WORDS: Record<string, [string, string]> = {
  km: ['kilomètre', 'kilomètres'], hm: ['hectomètre', 'hectomètres'], dam: ['décamètre', 'décamètres'],
  m: ['mètre', 'mètres'], dm: ['décimètre', 'décimètres'], cm: ['centimètre', 'centimètres'], mm: ['millimètre', 'millimètres'],
  kg: ['kilogramme', 'kilogrammes'], g: ['gramme', 'grammes'], mg: ['milligramme', 'milligrammes'], t: ['tonne', 'tonnes'],
  l: ['litre', 'litres'], dl: ['décilitre', 'décilitres'], cl: ['centilitre', 'centilitres'], ml: ['millilitre', 'millilitres'],
  'm²': ['mètre carré', 'mètres carrés'], 'cm²': ['centimètre carré', 'centimètres carrés'], 'km²': ['kilomètre carré', 'kilomètres carrés'],
  'm³': ['mètre cube', 'mètres cubes'], 'cm³': ['centimètre cube', 'centimètres cubes'],
  'km/h': ["kilomètre à l'heure", "kilomètres à l'heure"], '°C': ['degré Celsius', 'degrés Celsius'],
  min: ['minute', 'minutes'], s: ['seconde', 'secondes'],
};
const FEMININE_UNITS = new Set(['min', 's']);
const UNIT_KEYS = Object.keys(UNIT_WORDS).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|');

const NOT_ALNUM = '[^\\p{L}\\p{N}]';
const AMOUNT = '\\d{1,3}(?:[ \\u00a0\\u202f.]\\d{3})+|\\d+';

const UNIT = new RegExp(
  `(^|[^\\p{L}\\p{N}.,])(${AMOUNT})(?:,(\\d+))?\\s?(${UNIT_KEYS})(?![\\p{L}\\p{N}²³'’/])`,
  'gu',
);
const TIME_H = new RegExp(`(^|${NOT_ALNUM})(\\d{1,2})\\s?h\\s?(\\d{2})?(?![\\p{L}\\p{N}])`, 'gu');
const TIME_COLON = new RegExp(`(^|${NOT_ALNUM})(\\d{1,2}):(\\d{2})(?![\\p{L}\\p{N}:\\d])`, 'gu');
const DATE = new RegExp(`(^|[^\\p{L}\\p{N}/])(\\d{1,2})/(\\d{1,2})/(\\d{4})(?![\\p{L}\\p{N}/\\d])`, 'gu');
const RANGE = /(\d)[-–—](\d)/g;
const ORDINAL = new RegExp(`(^|${NOT_ALNUM})(\\d{1,12})(ers|er|res|re|ères|ère|èmes|ème|emes|eme|es|e)(?![\\p{L}\\p{N}])`, 'gu');
const EURO = new RegExp(`(^|[^\\p{L}\\p{N}.,])(${AMOUNT})(?:,(\\d{1,2}))?\\s?€`, 'gu');
const NUMBER = new RegExp(
  `(^|[^\\p{L}\\p{N}.,])(${AMOUNT})(?:,(\\d+))?(\\s?%)?(?![\\p{L}\\p{N}]|[.,]\\d|[/:]\\d|\\s?h(?![\\p{L}\\p{N}]))`,
  'gu',
);

export function numbersToBelgianWords(text: string): string {
  let out = text;

  // Unités : « 5 km » → « 5 kilomètres » ; pluriel dès que la valeur est 2 ou plus.
  out = out.replace(UNIT, (m, prefix: string, amount: string, decimals: string | undefined, unit: string) => {
    if (amount.replace(/\D/g, '').length > MAX_DIGITS) return m;
    const value = Number(`${intOf(amount)}.${decimals ?? '0'}`);
    const [one, many] = UNIT_WORDS[unit];
    if (value === 1 && decimals === undefined && FEMININE_UNITS.has(unit)) return `${prefix}une ${one}`;
    return `${prefix}${amount}${decimals === undefined ? '' : `,${decimals}`} ${value >= 2 ? many : one}`;
  });

  // Heures : « 9 h 30 », « 14h05 », « 10:30 ». Une heure ou une minute impossible laisse le texte tel quel.
  out = out.replace(TIME_H, (m, prefix: string, h: string, min: string | undefined) => {
    const hours = Number(h);
    const minutes = min === undefined ? 0 : Number(min);
    return hours > 24 || minutes > 59 ? m : prefix + clock(hours, minutes);
  });
  out = out.replace(TIME_COLON, (m, prefix: string, h: string, min: string) =>
    Number(h) > 23 || Number(min) > 59 ? m : prefix + clock(Number(h), Number(min)));

  // Dates complètes : « 16/11/2024 ». Sans année, « 1/2 » peut être une fraction : laissé tel quel.
  out = out.replace(DATE, (m, prefix: string, d: string, mo: string, y: string) => {
    const day = Number(d);
    const month = Number(mo);
    if (day < 1 || day > 31 || month < 1 || month > 12) return m;
    return `${prefix}${day === 1 ? 'premier' : cardinal(day)} ${MONTHS[month - 1]} ${cardinal(Number(y))}`;
  });

  // Périodes : « 1990-2024 » se lit « de … à … » ; le tiret collé à deux nombres devient « à ».
  out = out.replace(RANGE, '$1 à $2');

  // Ordinaux : « 71e » → « septante et unième ».
  out = out.replace(ORDINAL, (m, prefix: string, digits: string, suffix: string) => {
    if (digits.length > 1 && digits.startsWith('0')) return m;
    const n = Number(digits);
    if (n === 0) return m;
    return prefix + ordinal(n, /^(re|res|ère|ères)$/.test(suffix), suffix.endsWith('s'));
  });

  // Euros : « 1,70 € » → « un euro septante ».
  out = out.replace(EURO, (m, prefix: string, amount: string, cents: string | undefined) => {
    if (amount.replace(/\D/g, '').length > MAX_DIGITS) return m;
    const euros = intOf(amount);
    const centimes = cents === undefined ? 0 : Number(cents.padEnd(2, '0'));
    const unit = euros > 1 ? 'euros' : 'euro';
    return `${prefix}${cardinal(euros)} ${unit}${centimes > 0 ? ` ${cardinal(centimes)}` : ''}`;
  });

  // Autres nombres : entiers à groupes (75 000, 1.250), décimaux à virgule, pourcentages.
  out = out.replace(NUMBER, (m, prefix: string, amount: string, decimals: string | undefined, percent: string | undefined, offset: number, whole: string) => {
    const digitsOnly = amount.replace(/\D/g, '');
    if (digitsOnly.length > MAX_DIGITS) return m;
    if (amount.length > 1 && amount.startsWith('0') && decimals === undefined) return m;
    const start = offset + prefix.length;
    const before = whole.slice(Math.max(0, start - 4), start);
    if (/\d[/:]$/.test(before) || /\d\s?h\s?$/.test(before)) return m;
    const words = cardinal(intOf(amount)) + (decimals === undefined ? '' : ` virgule ${decimalWords(decimals)}`);
    return prefix + words + (percent ? ' pour cent' : '');
  });

  return out;
}
