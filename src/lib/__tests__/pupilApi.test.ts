import { describe, it, expect, vi, beforeEach } from 'vitest';

type Call = { table: string; op: string; args: unknown[] };
const calls: Call[] = [];
let result: { data?: unknown; error?: unknown; count?: number | null } = { data: [], error: null };

function chain(table: string) {
  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(result);
      return (...args: unknown[]) => { calls.push({ table, op: prop, args }); return new Proxy({}, handler); };
    },
  };
  return new Proxy({}, handler);
}

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => chain(table),
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  },
}));

import { createPupils, deletePupil, getPupilImpact, listPupils, setPupilClass } from '../api';

beforeEach(() => { calls.length = 0; result = { data: [], error: null }; });

describe('élèves : classe et suppression', () => {
  it('listPupils demande la classe et la convertit', async () => {
    result = { data: [{ id: 'a', code: 'E2', class_label: 'P4' }, { id: 'b', code: 'E1', class_label: null }], error: null };
    const list = await listPupils();
    expect(calls[0].args[0]).toBe('id, code, class_label');
    expect(list).toEqual([{ id: 'b', code: 'E1', classLabel: '' }, { id: 'a', code: 'E2', classLabel: 'P4' }]);
  });

  it('createPupils enregistre la classe normalisée', async () => {
    result = { data: [{ id: 'a', code: 'E1', class_label: 'P3 B' }], error: null };
    await createPupils(['E1'], '  P3   B ');
    const insert = calls.find(c => c.op === 'insert')!;
    expect(insert.args[0]).toEqual([{ user_id: 'u1', code: 'E1', class_label: 'P3 B' }]);
  });

  it('setPupilClass met à jour une seule ligne', async () => {
    await setPupilClass('a', ' P4 ');
    expect(calls.find(c => c.op === 'update')!.args[0]).toEqual({ class_label: 'P4' });
    expect(calls.find(c => c.op === 'eq')!.args).toEqual(['id', 'a']);
  });

  it('deletePupil supprime par identifiant', async () => {
    await deletePupil('a');
    expect(calls.map(c => c.op)).toContain('delete');
    expect(calls.find(c => c.op === 'eq')!.args).toEqual(['id', 'a']);
  });

  it('deletePupil échoue avec un message clair', async () => {
    result = { data: null, error: { message: 'boom' } };
    await expect(deletePupil('a')).rejects.toThrow('Suppression impossible.');
  });

  it('getPupilImpact compte les réponses et les dictées', async () => {
    result = { data: null, error: null, count: 7 };
    const impact = await getPupilImpact('a');
    expect(impact).toEqual({ attempts: 7, sessions: 7 });
  });
});
