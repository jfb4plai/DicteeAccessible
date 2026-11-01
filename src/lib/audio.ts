import { speechService } from './speech';
import { textHash } from './audioHash';
import { buildSpeakUrl } from './audioUrl';
import type { DictaItem, DictaSentence, Voice } from './types';

const START_TIMEOUT_MS = 8000;

// Lecteur élève : audio belge du serveur, repli sur la voix de l'appareil si l'audio échoue (réponse refusée, quota,
// lecture bloquée, délai). Les empreintes sont calculées à l'ouverture pour que la lecture démarre dans le geste de
// l'élève (certaines tablettes refusent un son lancé après une attente).
export function createPlayer(opts: { accessCode: string; voice: Voice }) {
  const hashes = new Map<string, string>();
  let current: HTMLAudioElement | null = null;

  async function prepare(items: DictaItem[], sentences: DictaSentence[]): Promise<void> {
    if (opts.voice === 'device') return;
    await Promise.all([
      ...items.map(async i => hashes.set(`word:${i.id}`, await textHash(i.word))),
      ...sentences.map(async s => hashes.set(`sentence:${s.id}`, await textHash(s.text))),
    ]);
  }

  function stop() {
    current?.pause();
    current = null;
    speechService.cancel();
  }

  async function play(kind: 'word' | 'sentence', id: string, text: string): Promise<void> {
    stop();
    if (opts.voice === 'device') return speechService.speak(text);
    try {
      const hash = hashes.get(`${kind}:${id}`) ?? await textHash(text);
      const audio = new Audio(buildSpeakUrl({ accessCode: opts.accessCode, kind, id, hash }));
      current = audio;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('délai')), START_TIMEOUT_MS);
        audio.onplaying = () => clearTimeout(timer);
        audio.onended = () => { clearTimeout(timer); resolve(); };
        audio.onerror = () => { clearTimeout(timer); reject(new Error('audio')); };
        audio.play().catch(e => { clearTimeout(timer); reject(e); });
      });
    } catch {
      current?.pause();
      current = null;
      await speechService.speak(text);
    }
  }

  return {
    prepare,
    stop,
    playWord: (item: DictaItem) => play('word', item.id, item.word),
    playSentence: (s: DictaSentence) => play('sentence', s.id, s.text),
  };
}

export type Player = ReturnType<typeof createPlayer>;
