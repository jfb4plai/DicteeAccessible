import { describe, it, expect } from 'vitest';
import { toSharedView, wordsToReview, shareErrorMessage, INVALID_SHARE_MESSAGE } from '../sharedView';

const raw = {
  pupil_code: 'E1',
  sessions: [
    {
      id: 's1', title: 'Dictée du 16/11', level: 'P3', mode: 'class', created_at: '2026-11-16T09:00:00Z', final_round: true,
      items: [{ id: 'i1', word: 'monsieur', position: 0 }, { id: 'i2', word: 'chat', position: 1 }],
      sentences: [{ id: 'x1', position: 0, text: 'Le chat dort.', item_id: 'i2' }],
      attempts: [
        // monsieur : juste au 2e essai puis raté au dernier tour => « non maîtrisé » (rouge)
        { item_id: 'i1', sentence_id: null, stage: 'A', kind: 'attempt', attempt_number: 1, answer: 'mesieur', correct: false, listens: 1 },
        { item_id: 'i1', sentence_id: null, stage: 'A', kind: 'attempt', attempt_number: 2, answer: 'monsieur', correct: true, listens: 1 },
        { item_id: 'i1', sentence_id: null, stage: 'C', kind: 'attempt', attempt_number: 1, answer: 'monsieu', correct: false, listens: 0 },
        // chat : réussi du premier coup
        { item_id: 'i2', sentence_id: null, stage: 'A', kind: 'attempt', attempt_number: 1, answer: 'chat', correct: true, listens: 1 },
      ],
      comment: 'Confond les finales.',
    },
    {
      id: 's2', title: 'Dictée suivante', level: 'P3', mode: 'class', created_at: '2026-11-23T09:00:00Z', final_round: true,
      items: [{ id: 'i3', word: 'droit', position: 0 }, { id: 'i4', word: 'lendemain', position: 1 }],
      attempts: [
        { item_id: 'i3', stage: 'A', kind: 'attempt', attempt_number: 1, answer: 'droit', correct: true },
        // lendemain : jamais réussi à l'étape A => « en cours », à revoir aussi
        { item_id: 'i4', stage: 'A', kind: 'attempt', attempt_number: 1, answer: 'landemin', correct: false },
        { item_id: 'i4', stage: 'A', kind: 'attempt', attempt_number: 2, answer: 'lendemin', correct: false },
      ],
    },
  ],
};

describe('toSharedView', () => {
  const view = toSharedView(raw);
  it('convertit en camelCase', () => {
    expect(view.pupilCode).toBe('E1');
    expect(view.sessions[0]).toMatchObject({ id: 's1', title: 'Dictée du 16/11', level: 'P3', mode: 'class', createdAt: '2026-11-16T09:00:00Z', finalRound: true });
    expect(view.sessions[0].items).toHaveLength(2);
    expect(view.sessions[0].attempts[0]).toMatchObject({ itemId: 'i1', stage: 'A', kind: 'attempt', attemptNumber: 1, correct: false, answer: 'mesieur' });
  });
  it('laisse comment à null si absent et parasites à []', () => {
    expect(view.sessions[0].comment).toBe('Confond les finales.');
    expect(view.sessions[1].comment).toBeNull();
    expect(view.sessions[0].sentences[0]).toMatchObject({ id: 'x1', parasites: [], itemId: 'i2' });
    expect(view.sessions[1].sentences).toEqual([]);
  });
  it('une réponse vide donne une vue vide', () => {
    expect(toSharedView({ pupil_code: 'E2', sessions: [] })).toEqual({ pupilCode: 'E2', sessions: [] });
  });
});

describe('wordsToReview', () => {
  it("liste les mots non maîtrisés ou jamais réussis, avec leur dictée, dans l'ordre des dictées", () => {
    expect(wordsToReview(toSharedView(raw))).toEqual([
      { word: 'monsieur', sessionId: 's1', sessionTitle: 'Dictée du 16/11' },
      { word: 'lendemain', sessionId: 's2', sessionTitle: 'Dictée suivante' },
    ]);
  });
  it('un élève sans réponse : rien à revoir', () => {
    expect(wordsToReview(toSharedView({ pupil_code: 'E2', sessions: [] }))).toEqual([]);
  });
});

describe('shareErrorMessage', () => {
  it('jeton inconnu, retiré ou expiré : un seul message', () => {
    expect(shareErrorMessage('invalid_share')).toBe(INVALID_SHARE_MESSAGE);
    expect(INVALID_SHARE_MESSAGE).toBe("Cet accès n'est plus valable. Demandez un nouveau lien à l'enseignant(e).");
  });
  it('limite de consultations', () => {
    expect(shareErrorMessage('rate_limited')).toContain('Trop de consultations');
  });
  it('autre erreur', () => {
    expect(shareErrorMessage('boom')).toBe('Consultation impossible. Réessayer.');
  });
});
