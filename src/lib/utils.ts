export function shuffleArray<T>(array: T[], rng: () => number = Math.random): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function calculateWordStats(attempts: any[]) {
  const wordStats: Record<string, { total: number; errors: number }> = {};

  attempts.forEach(attempt => {
    const word = attempt.correct_word || attempt.word;
    if (!wordStats[word]) {
      wordStats[word] = { total: 0, errors: 0 };
    }
    wordStats[word].total++;
    if (!attempt.is_correct) {
      wordStats[word].errors++;
    }
  });

  return wordStats;
}
