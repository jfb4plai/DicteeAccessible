export type SaveQueue<T> = {
  enqueue(job: T): void;
  pending(): number;
};

export function createSaveQueue<T>(opts: {
  send: (job: T) => Promise<void>;
  schedule?: (fn: () => void, ms: number) => void;
  retryMs?: number;
  onChange?: (pending: number) => void;
  // Mémorisation de la file (ex. localStorage) pour survivre à la fermeture de l'onglet.
  storage?: { load: () => T[]; save: (jobs: T[]) => void };
}): SaveQueue<T> {
  const schedule = opts.schedule ?? ((fn, ms) => { setTimeout(fn, ms); });
  const retryMs = opts.retryMs ?? 3000;
  const jobs: T[] = opts.storage?.load() ?? [];
  let running = false;

  function persist() {
    try { opts.storage?.save(jobs); } catch { /* quota ou stockage indisponible : la file reste en mémoire */ }
  }

  async function pump() {
    if (running) return;
    running = true;
    while (jobs.length > 0) {
      try {
        await opts.send(jobs[0]);
        jobs.shift();
        persist();
        opts.onChange?.(jobs.length);
      } catch {
        running = false;
        schedule(pump, retryMs);
        return;
      }
    }
    running = false;
  }

  if (jobs.length > 0) {
    opts.onChange?.(jobs.length);
    void pump();
  }

  return {
    enqueue(job: T) {
      jobs.push(job);
      persist();
      opts.onChange?.(jobs.length);
      void pump();
    },
    pending: () => jobs.length,
  };
}
