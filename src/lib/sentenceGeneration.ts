import { MAX_PARASITES, containsWord, filterParasites, maxWords, normalizeToken, sentenceTooLong, stripPunctuation, tokenizeSentence } from './sentences.js';

export type GenerateInput = {
  words: string[];
  level: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';
  rule?: string;
  context?: string;
  proximity?: Proximity;
};

export const PROXIMITIES = ['phonetic', 'spelling', 'both'] as const;
export type Proximity = (typeof PROXIMITIES)[number];

const LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;
const MAX_WORDS_PER_CALL = 40;
const MAX_WORD_LENGTH = 60;
const MAX_FREE_TEXT = 300;

export function validateGenerateInput(raw: unknown): { ok: true; value: GenerateInput } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Entrée invalide.' };
  const r = raw as Record<string, unknown>;
  const level = LEVELS.find(l => l === r.level);
  if (!level) return { ok: false, error: 'Niveau inconnu.' };
  if (!Array.isArray(r.words) || r.words.some(w => typeof w !== 'string')) return { ok: false, error: 'Mots invalides.' };

  const words = (r.words as string[]).map(w => w.trim()).filter(Boolean);
  if (words.length === 0) return { ok: false, error: 'Ajoute au moins un mot.' };
  if (words.length > MAX_WORDS_PER_CALL) return { ok: false, error: `Maximum ${MAX_WORDS_PER_CALL} mots.` };
  if (words.some(w => w.length > MAX_WORD_LENGTH)) return { ok: false, error: 'Un mot est trop long.' };

  const text = (v: unknown): string | undefined | null => {
    if (v === undefined || v === null || v === '') return undefined;
    if (typeof v !== 'string' || v.length > MAX_FREE_TEXT) return null;
    return v.trim() || undefined;
  };
  const rule = text(r.rule);
  const context = text(r.context);
  if (rule === null || context === null) return { ok: false, error: 'Texte trop long.' };

  let proximity: Proximity | undefined;
  if (r.proximity !== undefined && r.proximity !== null && r.proximity !== '') {
    proximity = PROXIMITIES.find(p => p === r.proximity);
    if (!proximity) return { ok: false, error: 'Proximité inconnue.' };
  }

  return { ok: true, value: { words, level, ...(rule && { rule }), ...(context && { context }), ...(proximity && { proximity }) } };
}

export const SENTENCE_SCHEMA = {
  type: 'object',
  properties: {
    sentences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          text: { type: 'string' },
          parasites: { type: 'array', items: { type: 'string' } },
        },
        required: ['word', 'text', 'parasites'],
        additionalProperties: false,
      },
    },
  },
  required: ['sentences'],
  additionalProperties: false,
} as const;

const PROXIMITY_LINES: Record<Proximity, string> = {
  phonetic: "Choisis des parasites qui se prononcent presque comme un mot de la phrase (par exemple pain et pin, mais et mets), même si leur orthographe diffère.",
  spelling: "Choisis des parasites dont l'orthographe est presque la même que celle d'un mot de la phrase : une ou deux lettres changées, ajoutées ou retirées (par exemple chat et chas, rue et rude).",
  both: "Choisis des parasites proches d'un mot de la phrase par le son ET par les lettres (par exemple pont et pond, vert et verre).",
};

export function buildSystemPrompt(input: Pick<GenerateInput, 'level' | 'rule' | 'context' | 'proximity'>): string {
  const lines = [
    `Tu prépares des phrases de dictée pour des élèves de ${input.level} en école primaire de la Fédération Wallonie-Bruxelles (Belgique francophone).`,
    `Pour chaque mot de la liste, écris UNE phrase courte et naturelle, adaptée au niveau ${input.level} (${maxWords(input.level)} mots au plus), qui contient le mot exactement tel qu'il est écrit dans la liste.`,
    'Utilise le vocabulaire et les situations de la vie d\'un enfant en Belgique. N\'écris aucun prénom ni aucun nom propre de personne.',
    `Pour chaque phrase, propose ${MAX_PARASITES} mots « parasites », du plus utile au moins utile : des mots de forme proche que l'élève pourrait confondre avec un mot de la phrase, et qui ne figurent pas dans la phrase.`,
  ];
  if (input.rule) {
    lines.push(`La règle travaillée est : « ${input.rule} ». Les parasites doivent obliger l'élève à choisir entre les formes que cette règle oppose : propose d'autres formes du même mot (pour un verbe, par exemple -é, -ée, -er, -ez).`);
  }
  if (input.proximity) lines.push(PROXIMITY_LINES[input.proximity]);
  if (input.context) {
    lines.push(`Contexte de la classe, à reprendre dans le vocabulaire des phrases quand c'est naturel : ${input.context}`);
  }
  lines.push('Réponds uniquement avec le JSON demandé, sans texte avant ni après.');
  return lines.join('\n');
}

export function buildUserPrompt(words: string[]): string {
  return `Mots de la dictée : ${JSON.stringify(words)}`;
}

export type SentenceFlag = 'mot_absent' | 'trop_longue' | 'prenom_probable';

export type GeneratedSentence = {
  word: string;
  text: string;
  parasites: string[];
  removedParasites: string[];
  flags: SentenceFlag[];
};

// Une majuscule hors début de phrase qui n'est pas un mot de la liste ressemble à un nom propre.
// Un prénom en début de phrase ne peut pas être distingué d'un mot ordinaire : l'enseignant(e) relit chaque phrase.
function hasProbableName(text: string, words: string[]): boolean {
  const known = new Set(words.map(w => normalizeToken(stripPunctuation(w))));
  const tokens = tokenizeSentence(text);
  return tokens.some((token, i) => {
    const atStart = i === 0 || /[.!?…]$/.test(tokens[i - 1]);
    const clean = stripPunctuation(token);
    return !atStart && /^\p{Lu}/u.test(clean) && !known.has(normalizeToken(clean));
  });
}

export function postProcessSentences(raw: unknown, words: string[], level: string): { sentences: GeneratedSentence[]; missing: string[] } {
  const list = typeof raw === 'object' && raw !== null && Array.isArray((raw as { sentences?: unknown }).sentences)
    ? ((raw as { sentences: unknown[] }).sentences)
    : [];

  const sentences: GeneratedSentence[] = [];
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.word !== 'string' || typeof e.text !== 'string' || !e.text.trim()) continue;
    const parasitesIn = Array.isArray(e.parasites) ? e.parasites.filter((p): p is string => typeof p === 'string') : [];
    const text = e.text.trim();
    const { kept, removed } = filterParasites(text, parasitesIn);

    const flags: SentenceFlag[] = [];
    if (!containsWord(text, e.word)) flags.push('mot_absent');
    if (sentenceTooLong(text, level)) flags.push('trop_longue');
    if (hasProbableName(text, words)) flags.push('prenom_probable');
    sentences.push({ word: e.word, text, parasites: kept, removedParasites: removed, flags });
  }

  const answered = new Set(sentences.map(s => normalizeToken(s.word)));
  const missing = words.filter(w => !answered.has(normalizeToken(w)));
  return { sentences, missing };
}
