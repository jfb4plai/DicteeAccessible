import { autoPrefilledIndices, buildLetterPool, isCorrectAnswer, wrongPositions } from './letters';

export type ExerciseState = {
  word: string;
  pool: string[];
  placed: (string | null)[];
  prefilled: number[];
  phase: 'placing' | 'ready' | 'right' | 'wrong';
  attemptCount: number;
  wrongIdx: number[];
};

export type ExerciseAction =
  | { type: 'place'; poolIndex: number }
  | { type: 'unplace'; slot: number }
  | { type: 'validate' }
  | { type: 'retry' };

function emptyPlaced(word: string, prefilled: number[]): (string | null)[] {
  return word.split('').map((char, i) => (prefilled.includes(i) ? char : null));
}

export function createExercise(word: string, rng: () => number = Math.random): ExerciseState {
  const prefilled = autoPrefilledIndices(word);
  return {
    word,
    pool: buildLetterPool(word, rng),
    placed: emptyPlaced(word, prefilled),
    prefilled,
    phase: 'placing',
    attemptCount: 0,
    wrongIdx: [],
  };
}

function firstEmptySlot(state: ExerciseState): number {
  return state.placed.findIndex((letter, i) => letter === null && !state.prefilled.includes(i));
}

export function exerciseReducer(state: ExerciseState, action: ExerciseAction): ExerciseState {
  switch (action.type) {
    case 'place': {
      if (state.phase !== 'placing') return state;
      const slot = firstEmptySlot(state);
      const letter = state.pool[action.poolIndex];
      if (slot === -1 || letter === undefined) return state;
      const placed = [...state.placed];
      placed[slot] = letter;
      const pool = state.pool.filter((_, i) => i !== action.poolIndex);
      const next = { ...state, placed, pool };
      return { ...next, phase: firstEmptySlot(next) === -1 ? 'ready' : 'placing' };
    }
    case 'unplace': {
      if (state.phase !== 'placing' && state.phase !== 'ready') return state;
      const letter = state.placed[action.slot];
      if (letter === null || letter === undefined || state.prefilled.includes(action.slot)) return state;
      const placed = [...state.placed];
      placed[action.slot] = null;
      return { ...state, placed, pool: [...state.pool, letter], phase: 'placing' };
    }
    case 'validate': {
      if (state.phase !== 'ready') return state;
      const attempt = state.placed.join('');
      const attemptCount = state.attemptCount + 1;
      if (isCorrectAnswer(attempt, state.word)) {
        return { ...state, phase: 'right', attemptCount, wrongIdx: [] };
      }
      return { ...state, phase: 'wrong', attemptCount, wrongIdx: wrongPositions(state.placed, state.word) };
    }
    case 'retry': {
      if (state.phase !== 'wrong') return state;
      return {
        ...state,
        pool: buildLetterPool(state.word),
        placed: emptyPlaced(state.word, state.prefilled),
        phase: 'placing',
        wrongIdx: [],
      };
    }
  }
}
