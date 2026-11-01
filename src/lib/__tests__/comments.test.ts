import { describe, it, expect } from 'vitest';
import { upsertComment } from '../comments';

describe('upsertComment', () => {
  it('remplace le commentaire du même élève', () => {
    const out = upsertComment([{ pupilId: 'p1', body: 'a', visible: false }], { pupilId: 'p1', body: 'b', visible: true });
    expect(out).toEqual([{ pupilId: 'p1', body: 'b', visible: true }]);
  });
  it('ajoute celui d\'un autre élève sans toucher au premier', () => {
    const out = upsertComment([{ pupilId: 'p1', body: 'a', visible: false }], { pupilId: 'p2', body: 'b', visible: false });
    expect(out).toHaveLength(2);
    expect(out[0].body).toBe('a');
  });
});
