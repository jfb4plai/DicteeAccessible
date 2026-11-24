import type { WorkspaceFacts } from '../../lib/workspace';
import type { WorkspaceData } from './common';

// Faits tirés de ce qui est ENREGISTRÉ (pas des saisies en cours) : les coches ne s'allument qu'après « Enregistrer ».
export function factsOf(data: WorkspaceData): WorkspaceFacts {
  return {
    title: data.session.title,
    wordCount: data.session.items.length,
    sentenceCount: data.sentences.length,
    validatedSentenceCount: data.sentences.filter(x => x.validated).length,
    pupilCount: data.session.pupils.length,
    published: data.session.published,
  };
}
