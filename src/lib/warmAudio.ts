import { audioHash } from './audioHash';
import { buildSpeakUrl } from './audioUrl';
import type { Voice } from './types';

export type AudioTarget = { kind: 'word' | 'sentence'; id: string; text: string };

// À la publication, le navigateur de l'enseignant(e) demande une fois chaque audio : le cache est chaud quand la classe
// arrive, et ElevenLabs ne reçoit pas 20 demandes simultanées. Au mieux : un échec n'arrête rien.
export async function warmAudio(
  targets: AudioTarget[],
  opts: { accessCode: string; voice: Voice; concurrency?: number; fetchFn?: (url: string) => Promise<Response> },
): Promise<{ requested: number; ok: number }> {
  if (opts.voice === 'device') return { requested: 0, ok: 0 };
  const fetchFn = opts.fetchFn ?? ((url: string) => fetch(url));
  const queue = [...targets];
  let ok = 0;

  async function worker() {
    for (let t = queue.shift(); t; t = queue.shift()) {
      try {
        const hash = await audioHash(opts.voice, t.text);
        const res = await fetchFn(buildSpeakUrl({ accessCode: opts.accessCode, kind: t.kind, id: t.id, hash }));
        if (res.ok) ok++;
      } catch {
        // Préchauffage au mieux : l'élève retombera sur la génération à la demande, puis sur la voix de l'appareil.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 2) }, worker));
  return { requested: targets.length, ok };
}
