import { getSessionForEdit, listSentences } from './api';
import { warmAudio } from './warmAudio';

// Préchauffe le cache audio d'une dictée publiée : au mieux, sans bloquer l'écran ni signaler d'erreur.
export async function warmSession(sessionId: string): Promise<void> {
  try {
    const s = await getSessionForEdit(sessionId);
    if (s.voice === 'device') return;
    const sentences = (await listSentences(sessionId)).filter(x => x.validated);
    await warmAudio(
      [
        ...s.items.map(i => ({ kind: 'word' as const, id: i.id, text: i.word })),
        ...sentences.map(x => ({ kind: 'sentence' as const, id: x.id, text: x.text })),
      ],
      { accessCode: s.accessCode, voice: s.voice },
    );
  } catch {
    // Sans importance : l'audio sera généré à la demande.
  }
}
