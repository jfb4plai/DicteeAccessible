import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('../supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } },
}));

import { createShare, listShares, revokeShare, viewShare } from '../api';
import { INVALID_SHARE_MESSAGE } from '../sharedView';

const T = 'A'.repeat(43);

beforeEach(() => { rpc.mockReset(); });

describe('viewShare', () => {
  it('un jeton mal formé est refusé sans aucun appel réseau', async () => {
    await expect(viewShare('court')).rejects.toThrow(INVALID_SHARE_MESSAGE);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('appelle dicta_share_view et renvoie une vue', async () => {
    rpc.mockResolvedValue({ data: { pupil_code: 'E1', sessions: [] }, error: null });
    await expect(viewShare(T)).resolves.toEqual({ pupilCode: 'E1', sessions: [] });
    expect(rpc).toHaveBeenCalledWith('dicta_share_view', { p_token: T });
  });
  it('invalid_share donne le message unique', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'invalid_share' } });
    await expect(viewShare(T)).rejects.toThrow(INVALID_SHARE_MESSAGE);
  });
  it('rate_limited est expliqué', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'rate_limited' } });
    await expect(viewShare(T)).rejects.toThrow('Trop de consultations');
  });
});

describe('createShare', () => {
  it('envoie la date en ISO et renvoie id et jeton', async () => {
    rpc.mockResolvedValue({ data: { id: 'sh1', token: T }, error: null });
    const expires = new Date('2027-08-31T21:59:59Z');
    await expect(createShare('p1', 'Ergo, Mme Dupont', expires)).resolves.toEqual({ id: 'sh1', token: T });
    expect(rpc).toHaveBeenCalledWith('dicta_share_create', { p_pupil_id: 'p1', p_label: 'Ergo, Mme Dupont', p_expires_at: '2027-08-31T21:59:59.000Z' });
  });
  it('too_many est expliqué', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'too_many' } });
    await expect(createShare('p1', 'X', new Date())).rejects.toThrow("10 invitations actives au plus pour cet élève. Retire-en une d'abord.");
  });
  it('libellé et date invalides sont expliqués', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'invalid_label' } });
    await expect(createShare('p1', '', new Date())).rejects.toThrow('nom');
    rpc.mockResolvedValue({ data: null, error: { message: 'invalid_expiry' } });
    await expect(createShare('p1', 'X', new Date())).rejects.toThrow('date');
  });
  it('une autre erreur ne montre jamais le texte brut de la base', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'relation "dicta_shares" does not exist' } });
    await expect(createShare('p1', 'X', new Date())).rejects.toThrow('Création du lien impossible.');
  });
});

describe('listShares et revokeShare', () => {
  it('listShares convertit en camelCase', async () => {
    rpc.mockResolvedValue({
      data: [{ id: 'sh1', label: 'Ergo', expires_at: '2027-08-31T21:59:59Z', revoked_at: null, last_used_at: '2026-11-03T10:00:00Z', created_at: '2026-11-02T10:00:00Z' }],
      error: null,
    });
    await expect(listShares('p1')).resolves.toEqual([
      { id: 'sh1', label: 'Ergo', expiresAt: '2027-08-31T21:59:59Z', revokedAt: null, lastUsedAt: '2026-11-03T10:00:00Z', createdAt: '2026-11-02T10:00:00Z' },
    ]);
    expect(rpc).toHaveBeenCalledWith('dicta_share_list', { p_pupil_id: 'p1' });
  });
  it('revokeShare appelle dicta_share_revoke', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await revokeShare('sh1');
    expect(rpc).toHaveBeenCalledWith('dicta_share_revoke', { p_share_id: 'sh1' });
  });
  it('revokeShare échoue avec un message clair', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'not_owner' } });
    await expect(revokeShare('sh1')).rejects.toThrow('Retrait impossible.');
  });
});
