import { describe, it, expect } from 'vitest';
import {
  validateGenerateInput, buildSystemPrompt, buildUserPrompt, postProcessSentences, SENTENCE_SCHEMA,
} from '../sentenceGeneration';

describe('validateGenerateInput', () => {
  const base = { words: ['soufflé'], level: 'P3' };
  it('accepte une entrée correcte et nettoie les mots', () => {
    const r = validateGenerateInput({ ...base, words: ['  soufflé ', 'chat'] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.words).toEqual(['soufflé', 'chat']);
  });
  it('refuse zéro mot', () => expect(validateGenerateInput({ ...base, words: [] }).ok).toBe(false));
  it('refuse plus de 40 mots', () => {
    const many = Array.from({ length: 41 }, (_, i) => `mot${i}`);
    expect(validateGenerateInput({ ...base, words: many }).ok).toBe(false);
  });
  it('refuse un niveau inconnu', () => expect(validateGenerateInput({ ...base, level: 'P7' }).ok).toBe(false));
  it('refuse un mot de plus de 60 caractères', () => {
    expect(validateGenerateInput({ ...base, words: ['a'.repeat(61)] }).ok).toBe(false);
  });
  it('refuse une règle ou un contexte de plus de 300 caractères', () => {
    expect(validateGenerateInput({ ...base, rule: 'x'.repeat(301) }).ok).toBe(false);
    expect(validateGenerateInput({ ...base, context: 'x'.repeat(301) }).ok).toBe(false);
  });
  it('refuse une entrée qui n\'est pas un objet', () => {
    expect(validateGenerateInput('texte').ok).toBe(false);
    expect(validateGenerateInput(null).ok).toBe(false);
  });
});

describe('prompts', () => {
  it('le prompt système contient le niveau, la règle et l\'interdiction des prénoms', () => {
    const p = buildSystemPrompt({ level: 'P3', rule: 'é ou er' });
    expect(p).toContain('P3');
    expect(p).toContain('é ou er');
    expect(p).toContain('prénom');
    expect(p).toContain('Fédération Wallonie-Bruxelles');
  });
  it('sans règle, aucune mention de règle', () => {
    expect(buildSystemPrompt({ level: 'P3' })).not.toContain('é ou er');
  });
  it('le contexte de classe est repris', () => {
    expect(buildSystemPrompt({ level: 'P3', context: 'sortie au parc de la Boverie' })).toContain('parc de la Boverie');
  });
  it('le prompt utilisateur liste les mots', () => {
    const p = buildUserPrompt(['soufflé', 'chat']);
    expect(p).toContain('soufflé');
    expect(p).toContain('chat');
  });
});

describe('SENTENCE_SCHEMA', () => {
  it('exige word, text et parasites, sans champ en plus', () => {
    const item = SENTENCE_SCHEMA.properties.sentences.items;
    expect(item.required).toEqual(['word', 'text', 'parasites']);
    expect(item.additionalProperties).toBe(false);
    expect(SENTENCE_SCHEMA.additionalProperties).toBe(false);
  });
});

describe('postProcessSentences', () => {
  const words = ['soufflé', 'maison', 'colline', 'pomme', 'chat'];
  const raw = {
    sentences: [
      { word: 'soufflé', text: 'Le vent a soufflé fort.', parasites: ['souffler', 'soufflez', 'soufflé'] },
      { word: 'maison', text: 'Il pleut.', parasites: [] },
      { word: 'colline', text: 'Le vent a soufflé très fort sur la colline hier soir.', parasites: [] },
      { word: 'pomme', text: 'Hier, Léa a mangé une pomme.', parasites: [] },
    ],
  };
  const out = postProcessSentences(raw, words, 'P1');
  const by = (w: string) => out.sentences.find(s => s.word === w)!;

  it('filtre les parasites égaux à un mot de la phrase', () => {
    expect(by('soufflé').parasites).toEqual(['souffler', 'soufflez']);
    expect(by('soufflé').removedParasites).toEqual(['soufflé']);
    expect(by('soufflé').flags).toEqual([]);
  });
  it('signale un mot cible absent', () => expect(by('maison').flags).toEqual(['mot_absent']));
  it('signale une phrase trop longue pour le niveau', () => expect(by('colline').flags).toEqual(['trop_longue']));
  it('signale un prénom probable hors début de phrase', () => expect(by('pomme').flags).toEqual(['prenom_probable']));
  it('ne signale pas la majuscule de début de phrase', () => {
    const r = postProcessSentences({ sentences: [{ word: 'chat', text: 'Le chat dort.', parasites: [] }] }, ['chat'], 'P3');
    expect(r.sentences[0].flags).toEqual([]);
  });
  it('liste les mots sans phrase dans missing', () => expect(out.missing).toEqual(['chat']));
  it('ignore les objets mal formés', () => {
    const r = postProcessSentences({ sentences: [{ word: 'chat' }, 42, null] }, ['chat'], 'P3');
    expect(r.sentences).toEqual([]);
    expect(r.missing).toEqual(['chat']);
  });
  it('renvoie tout en missing quand la sortie n\'est pas un objet', () => {
    expect(postProcessSentences('pas du json', words, 'P3')).toEqual({ sentences: [], missing: words });
  });
});
