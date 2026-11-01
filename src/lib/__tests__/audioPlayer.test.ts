import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const speak = vi.fn(async (_text: string) => {});
const cancel = vi.fn();
vi.mock('../speech', () => ({ speechService: { speak: (t: string) => speak(t), cancel: () => cancel() } }));

import { createPlayer } from '../audio';

class FakeAudio {
  static instances: FakeAudio[] = [];
  paused = false;
  onplaying: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private rejectPlay: ((e: unknown) => void) | null = null;
  constructor(public src: string) { FakeAudio.instances.push(this); }
  play() { return new Promise<void>((_res, rej) => { this.rejectPlay = rej; }); }
  pause() { this.paused = true; this.rejectPlay?.(new DOMException('interrompu', 'AbortError')); }
}

const tick = () => new Promise(r => setTimeout(r, 5));
const item = (id: string, word: string) => ({ id, word, position: 0 });

describe('createPlayer', () => {
  beforeEach(() => { FakeAudio.instances = []; speak.mockClear(); cancel.mockClear(); vi.stubGlobal('Audio', FakeAudio); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('voix de l\'appareil : aucun audio en ligne, texte converti en nombres belges', async () => {
    const player = createPlayer({ accessCode: 'ABCDEF', voice: 'device' });
    await player.playWord(item('i1', '90'));
    expect(FakeAudio.instances).toHaveLength(0);
    expect(speak).toHaveBeenCalledWith('nonante');
  });

  it('repli sur la voix de l\'appareil, avec le texte converti, quand l\'audio échoue', async () => {
    const player = createPlayer({ accessCode: 'ABCDEF', voice: 'adrien' });
    const done = player.playSentence({ id: 's1', position: 0, text: 'Il a 90 ans.', parasites: [], itemId: null });
    await tick();
    FakeAudio.instances[0].onerror?.();
    await done;
    expect(speak).toHaveBeenCalledWith('Il a nonante ans.');
  });

  it('demande l\'audio avec une URL canonique (code en majuscules, identifiants seulement)', async () => {
    const player = createPlayer({ accessCode: ' abcdef ', voice: 'adrien' });
    void player.playWord(item('00000000-0000-0000-0000-0000000000d1', 'chat'));
    await tick();
    expect(FakeAudio.instances[0].src).toMatch(/^\/api\/speak\?session=ABCDEF&kind=word&id=00000000-0000-0000-0000-0000000000d1&h=[0-9a-f]{16}$/);
  });

  it('une lecture abandonnée ne coupe pas la suivante et ne rejoue pas l\'ancien texte', async () => {
    const player = createPlayer({ accessCode: 'ABCDEF', voice: 'adrien' });
    void player.playWord(item('i1', 'ancien'));
    await tick();
    const second = player.playWord(item('i2', 'nouveau'));
    await tick();
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[0].paused).toBe(true);
    expect(FakeAudio.instances[1].paused).toBe(false);
    expect(speak).not.toHaveBeenCalledWith('ancien');
    FakeAudio.instances[1].onended?.();
    await second;
    expect(speak).not.toHaveBeenCalled();
  });
});
