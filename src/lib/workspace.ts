// Espace de travail d'une dictée : onglets, étapes complètes, prochaine étape. Logique pure, sans écran.

export const TAB_KEYS = ['contenu', 'reglages', 'phrases', 'eleves', 'publier', 'resultats'] as const;
export type TabKey = (typeof TAB_KEYS)[number];

export const TAB_LABELS: Record<TabKey, string> = {
  contenu: 'Contenu',
  reglages: 'Réglages',
  phrases: 'Phrases',
  eleves: 'Élèves',
  publier: 'Publier',
  resultats: 'Résultats',
};

export type WorkspaceFacts = {
  title: string;
  wordCount: number;
  sentenceCount: number;
  validatedSentenceCount: number;
  pupilCount: number;
  published: boolean;
};

export function parseTab(value: string | null | undefined): TabKey {
  return TAB_KEYS.find(k => k === value) ?? 'contenu';
}

// true = complet, false = à faire, null = facultatif (sans phrases) ou sans objet.
export function tabStatus(f: WorkspaceFacts): Record<TabKey, boolean | null> {
  return {
    contenu: f.title.trim().length > 0 && (f.wordCount > 0 || f.sentenceCount > 0),
    reglages: true, // les valeurs par défaut sont valides
    phrases: f.sentenceCount === 0 ? null : f.validatedSentenceCount === f.sentenceCount,
    eleves: f.pupilCount > 0,
    publier: f.published,
    resultats: null,
  };
}

// Ce qui empêche la publication, dans l'ordre où l'enseignant(e) peut le corriger.
export function publishBlockers(f: WorkspaceFacts): { tab: TabKey; message: string }[] {
  const s = tabStatus(f);
  const out: { tab: TabKey; message: string }[] = [];
  if (!s.contenu) out.push({ tab: 'contenu', message: f.title.trim() ? 'Ajoute au moins un mot ou une phrase.' : 'Donne un titre à la dictée et ajoute au moins un mot ou une phrase.' });
  if (s.phrases === false) {
    const left = f.sentenceCount - f.validatedSentenceCount;
    out.push({ tab: 'phrases', message: `${left} phrase${left > 1 ? 's' : ''} à valider.` });
  }
  if (!s.eleves) out.push({ tab: 'eleves', message: 'Choisis au moins un élève.' });
  return out;
}

// Première étape obligatoire incomplète, ou null quand tout est prêt (ou déjà publié).
export function nextStep(f: WorkspaceFacts): TabKey | null {
  if (f.published) return null;
  const blockers = publishBlockers(f);
  return blockers.length > 0 ? blockers[0].tab : 'publier';
}

// L'onglet Phrases est facultatif mais toujours proposé : « Passer cette étape » mène à l'onglet suivant.
export function followingTab(current: TabKey): TabKey {
  const i = TAB_KEYS.indexOf(current);
  return TAB_KEYS[Math.min(i + 1, TAB_KEYS.length - 1)];
}

// Message du bandeau « Prochaine étape » : ton encourageant, une seule chose à faire.
export function nextStepMessage(f: WorkspaceFacts): string {
  const next = nextStep(f);
  if (next === null) return 'La dictée est publiée. Tu peux encore la modifier ou suivre les résultats.';
  if (next === 'contenu') return 'Commence par donner un titre à la dictée et ajouter au moins un mot (ou une phrase).';
  if (next === 'phrases') {
    const left = f.sentenceCount - f.validatedSentenceCount;
    return `Presque là : il reste ${left} phrase${left > 1 ? 's' : ''} à relire et valider.`;
  }
  if (next === 'eleves') return 'Bien avancé. Choisis maintenant qui recevra la dictée.';
  return "Tout est prêt : il ne reste qu'à publier la dictée.";
}
