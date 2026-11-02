import { describe, it, expect } from 'vitest';
import { groupByClass, normalizeClassLabel, NO_CLASS } from '../pupilGroups';
import { toPupil } from '../apiMapping';

const p = (code: string, classLabel = '') => ({ id: `id-${code}`, code, classLabel });

describe('normalizeClassLabel', () => {
  it('retire les espaces en trop', () => {
    expect(normalizeClassLabel('  P3   B ')).toBe('P3 B');
  });
  it('limite à 30 caractères', () => {
    expect(normalizeClassLabel('x'.repeat(40))).toHaveLength(30);
  });
  it('un libellé vide reste vide', () => {
    expect(normalizeClassLabel('   ')).toBe('');
  });
});

describe('groupByClass', () => {
  it('regroupe par classe, classes dans l\'ordre naturel, « sans classe » en dernier', () => {
    const groups = groupByClass([p('E1'), p('E2', 'P4'), p('E3', 'P3'), p('E10', 'P3'), p('E4', 'P3')]);
    expect(groups.map(g => g.label)).toEqual(['P3', 'P4', NO_CLASS]);
    expect(groups[0].pupils.map(x => x.code)).toEqual(['E3', 'E4', 'E10']);
    expect(groups[2].pupils.map(x => x.code)).toEqual(['E1']);
  });
  it('ne crée pas de groupe vide', () => {
    expect(groupByClass([p('E1', 'P3')]).map(g => g.label)).toEqual(['P3']);
  });
  it('liste vide : aucun groupe', () => {
    expect(groupByClass([])).toEqual([]);
  });
  it('P10 vient après P9 (tri naturel)', () => {
    expect(groupByClass([p('E1', 'P10'), p('E2', 'P9')]).map(g => g.label)).toEqual(['P9', 'P10']);
  });
});

describe('toPupil', () => {
  it('convertit une ligne de la base', () => {
    expect(toPupil({ id: 'a', code: 'E1', class_label: 'P3' })).toEqual({ id: 'a', code: 'E1', classLabel: 'P3' });
  });
  it('une classe absente donne une chaîne vide', () => {
    expect(toPupil({ id: 'a', code: 'E1' })).toEqual({ id: 'a', code: 'E1', classLabel: '' });
    expect(toPupil({ id: 'a', code: 'E1', class_label: null })).toEqual({ id: 'a', code: 'E1', classLabel: '' });
  });
});
