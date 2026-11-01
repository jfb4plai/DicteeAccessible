import { describe, it, expect } from 'vitest';
import { createExercise, exerciseReducer, type ExerciseState } from '../letterExercise';

function placeWord(state: ExerciseState, letters: string[]): ExerciseState {
  let s = state;
  for (const l of letters) s = exerciseReducer(s, { type: 'place', poolIndex: s.pool.indexOf(l) });
  return s;
}

describe('createExercise', () => {
  it('démarre en placing avec des cases vides et le pool des lettres', () => {
    const s = createExercise('chat');
    expect(s.phase).toBe('placing');
    expect(s.placed).toEqual([null, null, null, null]);
    expect([...s.pool].sort()).toEqual(['a', 'c', 'h', 't']);
  });

  it("préremplit l'apostrophe", () => {
    const s = createExercise("l'été");
    expect(s.prefilled).toEqual([1]);
    expect(s.placed[1]).toBe("'");
  });
});

describe('exerciseReducer', () => {
  it('passe en ready quand tout est rempli puis right à la validation', () => {
    let s = placeWord(createExercise('chat'), ['c', 'h', 'a', 't']);
    expect(s.phase).toBe('ready');
    s = exerciseReducer(s, { type: 'validate' });
    expect(s.phase).toBe('right');
    expect(s.attemptCount).toBe(1);
  });

  it('marque les cases fausses puis retry efface sans toucher au compteur', () => {
    let s = placeWord(createExercise('chat'), ['c', 'h', 't', 'a']);
    s = exerciseReducer(s, { type: 'validate' });
    expect(s.phase).toBe('wrong');
    expect(s.wrongIdx).toEqual([2, 3]);
    s = exerciseReducer(s, { type: 'retry' });
    expect(s.phase).toBe('placing');
    expect(s.placed).toEqual([null, null, null, null]);
    expect(s.attemptCount).toBe(1);
  });

  it('ne retire jamais une case préremplie', () => {
    const s = createExercise("l'été");
    expect(exerciseReducer(s, { type: 'unplace', slot: 1 })).toEqual(s);
  });

  it('rend la lettre au pool quand on la retire', () => {
    let s = placeWord(createExercise('chat'), ['c']);
    s = exerciseReducer(s, { type: 'unplace', slot: 0 });
    expect(s.placed[0]).toBeNull();
    expect([...s.pool].sort()).toEqual(['a', 'c', 'h', 't']);
  });

  it('ignore un placement quand tout est rempli', () => {
    const full = placeWord(createExercise('chat'), ['c', 'h', 'a', 't']);
    expect(exerciseReducer(full, { type: 'place', poolIndex: 0 })).toEqual(full);
  });
});
