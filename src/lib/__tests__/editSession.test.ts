import { describe, it, expect } from 'vitest';
import { planPupilChanges, planWordChanges, validateWordRows } from '../editSession';

const existing = [
  { id: 'a', word: 'chat', position: 0 },
  { id: 'b', word: 'chien', position: 1 },
  { id: 'c', word: 'oiseau', position: 2 },
];

describe('validateWordRows', () => {
  it('retire les lignes vides et les espaces autour des mots', () => {
    const r = validateWordRows([{ id: 'a', word: ' chat ' }, { word: '   ' }, { word: 'lapin' }]);
    expect(r).toEqual({ ok: true, rows: [{ id: 'a', word: 'chat' }, { word: 'lapin' }] });
  });
  it('refuse un doublon, sans tenir compte de la casse', () => {
    const r = validateWordRows([{ word: 'Chat' }, { word: 'chat' }]);
    expect(r.ok).toBe(false);
  });
  it('refuse plus de 40 mots et un mot de plus de 60 caractères', () => {
    expect(validateWordRows(Array.from({ length: 41 }, (_, i) => ({ word: `mot${i}` }))).ok).toBe(false);
    expect(validateWordRows([{ word: 'a'.repeat(61) }]).ok).toBe(false);
  });
  it('accepte zéro mot (autodictée de phrases seulement)', () => {
    expect(validateWordRows([])).toEqual({ ok: true, rows: [] });
  });
});

describe('planWordChanges', () => {
  it('corriger un mot garde son identifiant, donc ses résultats', () => {
    const plan = planWordChanges(existing, [{ id: 'a', word: 'chats' }, { id: 'b', word: 'chien' }, { id: 'c', word: 'oiseau' }]);
    expect(plan.removedIds).toEqual([]);
    expect(plan.upserts[0]).toEqual({ id: 'a', word: 'chats', position: 0 });
  });
  it('un mot retiré est listé pour suppression, un mot ajouté n\'a pas d\'identifiant', () => {
    const plan = planWordChanges(existing, [{ id: 'c', word: 'oiseau' }, { word: 'lapin' }, { id: 'a', word: 'chat' }]);
    expect(plan.removedIds).toEqual(['b']);
    expect(plan.upserts).toEqual([
      { id: 'c', word: 'oiseau', position: 0 },
      { word: 'lapin', position: 1 },
      { id: 'a', word: 'chat', position: 2 },
    ]);
  });
  it('tout retirer supprime tous les mots', () => {
    expect(planWordChanges(existing, []).removedIds).toEqual(['a', 'b', 'c']);
  });
});

describe('planPupilChanges', () => {
  it('ajoute les nouveaux élèves et retire ceux qui sont décochés', () => {
    expect(planPupilChanges(['e1', 'e2', 'e3'], ['e2', 'e4'])).toEqual({ add: ['e4'], remove: ['e1', 'e3'] });
  });
  it('rien à changer', () => {
    expect(planPupilChanges(['e1'], ['e1'])).toEqual({ add: [], remove: [] });
  });
});
