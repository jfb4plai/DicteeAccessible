import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const speak = vi.fn(async (_text: string, _rate?: number) => {});
const cancel = vi.fn();
vi.mock('../speech', () => ({ speechService: { speak: (t: string, r?: number) => speak(t, r), cancel: () => cancel() } }));

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
  playbackRate = 1;
  preservesPitch = false;
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
    expect(speak).toHaveBeenCalledWith('nonante', 0.9);
  });

  it('repli sur la voix de l\'appareil, avec le texte converti, quand l\'audio échoue', async () => {
    const player = createPlayer({ accessCode: 'ABCDEF', voice: 'adrien' });
    const done = player.playSentence({ id: 's1', position: 0, text: 'Il a 90 ans.', parasites: [], itemId: null });
    await tick();
    FakeAudio.instances[0].onerror?.();
    await done;
    expect(speak).toHaveBeenCalledWith('Il a nonante ans.', 0.9);
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

  it('phrase plus lente : playbackRate 0.75 puis 0.5 sur l\'audio, hauteur conservée', async () => {
    const player = createPlayer({ accessCode: 'ABCDEF', voice: 'adrien' });
    const s = { id: 's1', position: 0, text: 'Il a 90 ans.', parasites: [], itemId: null };
    void player.playSentence(s, 0.75);
    await tick();
    expect(FakeAudio.instances[0].playbackRate).toBe(0.75);
    expect(FakeAudio.instances[0].preservesPitch).toBe(true);
    void player.playSentence(s, 0.5);
    await tick();
    expect(FakeAudio.instances[1].playbackRate).toBe(0.5);
    void player.playSentence(s);
    await tick();
    expect(FakeAudio.instances[2].playbackRate).toBe(1);
  });

  it('voix de l\'appareil : la vitesse multiplie la vitesse habituelle', async () => {
    const player = createPlayer({ accessCode: 'ABCDEF', voice: 'device' });
    await player.playSentence({ id: 's1', position: 0, text: 'Le chat dort.', parasites: [], itemId: null }, 0.5);
    expect(speak).toHaveBeenCalledWith('Le chat dort.', 0.45);
  });

  it('mot plus lent : playbackRate 0.75 et 0.5, vitesse normale par défaut', async () => {
    const player = createPlayer({ accessCode: 'ABCDEF', voice: 'adrien' });
    void player.playWord(item('i1', 'chat'), 0.75);
    await tick();
    expect(FakeAudio.instances[0].playbackRate).toBe(0.75);
    void player.playWord(item('i1', 'chat'), 0.5);
    await tick();
    expect(FakeAudio.instances[1].playbackRate).toBe(0.5);
    void player.playWord(item('i1', 'chat'));
    await tick();
    expect(FakeAudio.instances[2].playbackRate).toBe(1);
  });

  it('mot avec la voix de l\'appareil : la vitesse multiplie la vitesse habituelle', async () => {
    const player = createPlayer({ accessCode: 'ABCDEF', voice: 'device' });
    await player.playWord(item('i1', 'chat'), 0.75);
    expect(speak).toHaveBeenCalledWith('chat', 0.675);
  });
});
