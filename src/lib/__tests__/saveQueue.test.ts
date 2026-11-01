import { describe, it, expect } from 'vitest';
import { createSaveQueue } from '../saveQueue';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('createSaveQueue', () => {
  it("réessaie après un échec et garde la file jusqu'au succès", async () => {
    let calls = 0;
    const scheduled: (() => void)[] = [];
    const changes: number[] = [];
    const q = createSaveQueue<string>({
      send: async () => {
        calls++;
        if (calls <= 2) throw new Error('réseau');
      },
      schedule: fn => { scheduled.push(fn); },
      onChange: n => changes.push(n),
    });
    q.enqueue('a');
    await tick();
    expect([calls, q.pending(), scheduled.length]).toEqual([1, 1, 1]);
    scheduled.shift()!();
    await tick();
    expect([calls, q.pending(), scheduled.length]).toEqual([2, 1, 1]);
    scheduled.shift()!();
    await tick();
    expect([calls, q.pending()]).toEqual([3, 0]);
    expect(changes).toEqual([1, 0]);
  });

  it("envoie dans l'ordre d'insertion", async () => {
    const sent: string[] = [];
    const q = createSaveQueue<string>({
      send: async job => { sent.push(job); },
      schedule: () => {},
    });
    q.enqueue('a');
    q.enqueue('b');
    await tick();
    expect(sent).toEqual(['a', 'b']);
    expect(q.pending()).toBe(0);
  });
});
