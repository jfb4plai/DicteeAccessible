export type SaveQueue<T> = {
  enqueue(job: T): void;
  pending(): number;
};

export function createSaveQueue<T>(opts: {
  send: (job: T) => Promise<void>;
  schedule?: (fn: () => void, ms: number) => void;
  retryMs?: number;
  onChange?: (pending: number) => void;
}): SaveQueue<T> {
  const schedule = opts.schedule ?? ((fn, ms) => { setTimeout(fn, ms); });
  const retryMs = opts.retryMs ?? 3000;
  const jobs: T[] = [];
  let running = false;

  async function pump() {
    if (running) return;
    running = true;
    while (jobs.length > 0) {
      try {
        await opts.send(jobs[0]);
        jobs.shift();
        opts.onChange?.(jobs.length);
      } catch {
        running = false;
        schedule(pump, retryMs);
        return;
      }
    }
    running = false;
  }

  return {
    enqueue(job: T) {
      jobs.push(job);
      opts.onChange?.(jobs.length);
      void pump();
    },
    pending: () => jobs.length,
  };
}
