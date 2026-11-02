import type { Pupil } from './types';

export const NO_CLASS = 'Sans classe';
export const MAX_CLASS_LABEL = 30;

// Nom de groupe libre (« P3 », « P3 B »). Jamais un prénom : l'application ne connaît que des codes.
export function normalizeClassLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_CLASS_LABEL).trim();
}

const codeNumber = (p: Pupil) => Number(p.code.replace(/\D/g, ''));
const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

// Une section par classe, classes dans l'ordre naturel (P9 avant P10), élèves sans classe en dernier.
export function groupByClass(pupils: Pupil[]): { label: string; pupils: Pupil[] }[] {
  const byLabel = new Map<string, Pupil[]>();
  for (const p of pupils) {
    const label = p.classLabel ? p.classLabel : NO_CLASS;
    byLabel.set(label, [...(byLabel.get(label) ?? []), p]);
  }
  return [...byLabel.entries()]
    .sort(([a], [b]) => (a === NO_CLASS ? 1 : b === NO_CLASS ? -1 : collator.compare(a, b)))
    .map(([label, list]) => ({ label, pupils: [...list].sort((x, y) => codeNumber(x) - codeNumber(y)) }));
}
