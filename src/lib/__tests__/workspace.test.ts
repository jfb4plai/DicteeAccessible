import { describe, it, expect } from 'vitest';
import { followingTab, nextStep, nextStepMessage, parseTab, publishBlockers, tabStatus, type WorkspaceFacts } from '../workspace';

const base: WorkspaceFacts = { title: 'Dictée du 16/11', wordCount: 5, sentenceCount: 0, validatedSentenceCount: 0, pupilCount: 3, published: false };

describe('parseTab', () => {
  it('connaît les onglets, sinon retombe sur Contenu', () => {
    expect(parseTab('eleves')).toBe('eleves');
    expect(parseTab('nimporte')).toBe('contenu');
    expect(parseTab(null)).toBe('contenu');
  });
});

describe('tabStatus', () => {
  it('contenu : titre et au moins un mot ou une phrase', () => {
    expect(tabStatus(base).contenu).toBe(true);
    expect(tabStatus({ ...base, title: '  ' }).contenu).toBe(false);
    expect(tabStatus({ ...base, wordCount: 0 }).contenu).toBe(false);
    expect(tabStatus({ ...base, wordCount: 0, sentenceCount: 2, validatedSentenceCount: 2 }).contenu).toBe(true);
  });
  it('phrases : facultatif sans phrase, complet quand toutes sont validées', () => {
    expect(tabStatus(base).phrases).toBeNull();
    expect(tabStatus({ ...base, sentenceCount: 3, validatedSentenceCount: 2 }).phrases).toBe(false);
    expect(tabStatus({ ...base, sentenceCount: 3, validatedSentenceCount: 3 }).phrases).toBe(true);
  });
  it('élèves et publication', () => {
    expect(tabStatus({ ...base, pupilCount: 0 }).eleves).toBe(false);
    expect(tabStatus({ ...base, published: true }).publier).toBe(true);
  });
});

describe('publishBlockers et nextStep', () => {
  it('tout est prêt : la prochaine étape est Publier', () => {
    expect(publishBlockers(base)).toEqual([]);
    expect(nextStep(base)).toBe('publier');
  });
  it('la prochaine étape est la première lacune, dans l\'ordre du parcours', () => {
    expect(nextStep({ ...base, title: '', pupilCount: 0 })).toBe('contenu');
    expect(nextStep({ ...base, sentenceCount: 2, validatedSentenceCount: 1, pupilCount: 0 })).toBe('phrases');
    expect(nextStep({ ...base, pupilCount: 0 })).toBe('eleves');
  });
  it('accorde le message au pluriel', () => {
    expect(publishBlockers({ ...base, sentenceCount: 3, validatedSentenceCount: 1 })[0].message).toBe('2 phrases à valider.');
    expect(publishBlockers({ ...base, sentenceCount: 2, validatedSentenceCount: 1 })[0].message).toBe('1 phrase à valider.');
  });
  it('une dictée publiée n\'a plus de prochaine étape', () => {
    expect(nextStep({ ...base, published: true })).toBeNull();
  });
});

describe('followingTab', () => {
  it('passe à l\'onglet suivant dans l\'ordre, Phrases comprise', () => {
    expect(followingTab('contenu')).toBe('reglages');
    expect(followingTab('reglages')).toBe('phrases');
    expect(followingTab('phrases')).toBe('eleves');
    expect(followingTab('publier')).toBe('resultats');
    expect(followingTab('resultats')).toBe('resultats');
  });
});

describe('nextStepMessage', () => {
  it('guide vers la prochaine lacune, au pluriel correct', () => {
    expect(nextStepMessage({ ...base, title: '' })).toContain('titre');
    expect(nextStepMessage({ ...base, sentenceCount: 3, validatedSentenceCount: 1 })).toContain('2 phrases à relire');
    expect(nextStepMessage({ ...base, sentenceCount: 2, validatedSentenceCount: 1 })).toContain('1 phrase à relire');
    expect(nextStepMessage({ ...base, pupilCount: 0 })).toContain('qui recevra');
    expect(nextStepMessage(base)).toContain('publier');
    expect(nextStepMessage({ ...base, published: true })).toContain('publiée');
  });
});
