import { describe, it, expect } from 'vitest';
import { createTileExercise, tileReducer, type TileState } from '../tileExercise';

const sentence = { text: 'Le vent a soufflé fort.', parasites: ['souffler', 'soufflez'] };

function place(state: TileState, text: string): TileState {
  return tileReducer(state, { type: 'place', poolIndex: state.pool.findIndex(t => t.text === text && !t.parasite) });
}
function placeAll(state: TileState, texts: string[]): TileState {
  return texts.reduce(place, state);
}
const GOOD = ['Le', 'vent', 'a', 'soufflé', 'fort.'];

describe('createTileExercise', () => {
  it('prépare 5 cases vides et 7 tuiles', () => {
    const s = createTileExercise(sentence);
    expect(s.slots).toEqual([null, null, null, null, null]);
    expect(s.pool).toHaveLength(7);
    expect(s.phase).toBe('placing');
  });
});

describe('tileReducer', () => {
  it('ready quand les 5 cases sont pleines, les parasites restent dans le pool, puis right', () => {
    let s = placeAll(createTileExercise(sentence), GOOD);
    expect(s.phase).toBe('ready');
    expect(s.pool.map(t => t.text).sort()).toEqual(['souffler', 'soufflez']);
    s = tileReducer(s, { type: 'validate' });
    expect(s.phase).toBe('right');
    expect(s.attemptCount).toBe(1);
  });

  it('un parasite à la place du bon mot donne wrong avec la bonne position', () => {
    let s = createTileExercise(sentence);
    s = placeAll(s, ['Le', 'vent', 'a']);
    s = tileReducer(s, { type: 'place', poolIndex: s.pool.findIndex(t => t.text === 'souffler') });
    s = place(s, 'fort.');
    s = tileReducer(s, { type: 'validate' });
    expect(s.phase).toBe('wrong');
    expect(s.wrongIdx).toEqual([3]);
  });

  it('retry vide les cases et remet toutes les tuiles dans le pool, sans toucher au compteur', () => {
    let s = placeAll(createTileExercise(sentence), ['vent', 'Le', 'a', 'soufflé', 'fort.']);
    s = tileReducer(s, { type: 'validate' });
    s = tileReducer(s, { type: 'retry' });
    expect(s.phase).toBe('placing');
    expect(s.slots).toEqual([null, null, null, null, null]);
    expect(s.pool).toHaveLength(7);
    expect(s.attemptCount).toBe(1);
  });

  it('unplace rend la tuile au pool', () => {
    let s = place(createTileExercise(sentence), 'Le');
    s = tileReducer(s, { type: 'unplace', slot: 0 });
    expect(s.slots[0]).toBeNull();
    expect(s.pool).toHaveLength(7);
    expect(s.phase).toBe('placing');
  });

  it('ignore un placement quand toutes les cases sont pleines', () => {
    const full = placeAll(createTileExercise(sentence), GOOD);
    expect(tileReducer(full, { type: 'place', poolIndex: 0 })).toEqual(full);
  });

  it('gère une phrase avec apostrophe typographique', () => {
    const s0 = createTileExercise({ text: 'L’été est là.', parasites: [] });
    const s = tileReducer(placeAll(s0, ['L’été', 'est', 'là.']), { type: 'validate' });
    expect(s.phase).toBe('right');
  });
});
