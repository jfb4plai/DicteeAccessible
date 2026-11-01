import { speechService } from './speech';
import { audioHash } from './audioHash';
import { buildSpeakUrl } from './audioUrl';
import { toBelgianSpeech } from './belgianSpeech';
import type { DictaItem, DictaSentence, Voice } from './types';

const START_TIMEOUT_MS = 8000;

// Lecteur élève : audio belge du serveur, repli sur la voix de l'appareil si l'audio échoue (réponse refusée, quota,
// lecture bloquée, délai). La voix de l'appareil reçoit aussi les nombres en lettres belges.
// Les empreintes sont calculées à l'ouverture pour que la lecture démarre dans le geste de l'élève
// (certaines tablettes refusent un son lancé après une attente).
export function createPlayer(opts: { accessCode: string; voice: Voice }) {
  const hashes = new Map<string, string>();
  let current: HTMLAudioElement | null = null;
  let token = 0; // numéro de la lecture en cours : une lecture abandonnée ne doit rien déclencher

  async function prepare(items: DictaItem[], sentences: DictaSentence[]): Promise<void> {
    if (opts.voice === 'device') return;
    try {
      await Promise.all([
        ...items.map(async i => hashes.set(`word:${i.id}`, await audioHash(opts.voice, i.word))),
        ...sentences.map(async s => hashes.set(`sentence:${s.id}`, await audioHash(opts.voice, s.text))),
      ]);
    } catch {
      // Empreintes indisponibles (contexte non sécurisé) : play() les recalcule, ou se replie sur la voix de l'appareil.
    }
  }

  function stop() {
    current?.pause();
    current = null;
    speechService.cancel();
  }

  async function play(kind: 'word' | 'sentence', id: string, text: string): Promise<void> {
    const mine = ++token;
    stop();
    if (opts.voice === 'device') return speechService.speak(toBelgianSpeech(text));
    let audio: HTMLAudioElement | null = null;
    try {
      const hash = hashes.get(`${kind}:${id}`) ?? await audioHash(opts.voice, text);
      if (mine !== token) return;
      const started = new Audio(buildSpeakUrl({ accessCode: opts.accessCode, kind, id, hash }));
      audio = started;
      current = started;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('délai')), START_TIMEOUT_MS);
        started.onplaying = () => clearTimeout(timer);
        started.onended = () => { clearTimeout(timer); resolve(); };
        started.onerror = () => { clearTimeout(timer); reject(new Error('audio')); };
        started.play().catch(e => { clearTimeout(timer); reject(e); });
      });
    } catch {
      if (mine !== token) return; // une lecture plus récente a commencé : on ne touche ni à elle ni à l'ancien texte
      audio?.pause();
      if (current === audio) current = null;
      await speechService.speak(toBelgianSpeech(text));
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
