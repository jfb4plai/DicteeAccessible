import { buildSentenceTiles, isCorrectSentenceAnswer, normalizeToken, tokenizeSentence, type SentenceTile } from './sentences';
import { shuffleArray } from './utils';

export type TileState = {
  tokens: string[];
  pool: SentenceTile[];
  slots: (SentenceTile | null)[];
  phase: 'placing' | 'ready' | 'right' | 'wrong';
  attemptCount: number;
  wrongIdx: number[];
};

export type TileAction =
  | { type: 'place'; poolIndex: number }
  | { type: 'unplace'; slot: number }
  | { type: 'validate' }
  | { type: 'retry' };

export function createTileExercise(s: { text: string; parasites: string[] }, rng: () => number = Math.random): TileState {
  const tokens = tokenizeSentence(s.text);
  return {
    tokens,
    pool: buildSentenceTiles(s, rng),
    slots: tokens.map(() => null),
    phase: 'placing',
    attemptCount: 0,
    wrongIdx: [],
  };
}

export function tileReducer(state: TileState, action: TileAction): TileState {
  switch (action.type) {
    case 'place': {
      if (state.phase !== 'placing') return state;
      const slot = state.slots.indexOf(null);
      const tile = state.pool[action.poolIndex];
      if (slot === -1 || !tile) return state;
      const slots = [...state.slots];
      slots[slot] = tile;
      return {
        ...state,
        slots,
        pool: state.pool.filter((_, i) => i !== action.poolIndex),
        phase: slots.every(Boolean) ? 'ready' : 'placing',
      };
    }
    case 'unplace': {
      if (state.phase !== 'placing' && state.phase !== 'ready') return state;
      const tile = state.slots[action.slot];
      if (!tile) return state;
      const slots = [...state.slots];
      slots[action.slot] = null;
      return { ...state, slots, pool: [...state.pool, tile], phase: 'placing' };
    }
    case 'validate': {
      if (state.phase !== 'ready') return state;
      const answer = state.slots.map(t => t!.text);
      const attemptCount = state.attemptCount + 1;
      if (isCorrectSentenceAnswer(answer, state.tokens.join(' '))) {
        return { ...state, phase: 'right', attemptCount, wrongIdx: [] };
      }
      const wrongIdx = state.tokens
        .map((tok, i) => (normalizeToken(tok) === normalizeToken(answer[i]) ? -1 : i))
        .filter(i => i >= 0);
      return { ...state, phase: 'wrong', attemptCount, wrongIdx };
    }
    case 'retry': {
      if (state.phase !== 'wrong') return state;
      const placed = state.slots.filter((t): t is SentenceTile => t !== null);
      return {
        ...state,
        pool: shuffleArray([...state.pool, ...placed]),
        slots: state.tokens.map(() => null),
        phase: 'placing',
        wrongIdx: [],
      };
    }
  }
}
