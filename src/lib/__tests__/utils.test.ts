import { describe, it, expect } from 'vitest';
import { shuffleArray, formatDuration } from '../utils';

describe('utils', () => {
  it('shuffleArray garde les mêmes éléments et ne modifie pas l\'entrée', () => {
    const input = [1, 2, 3, 4];
    const out = shuffleArray(input, () => 0);
    expect([...out].sort()).toEqual([1, 2, 3, 4]);
    expect(input).toEqual([1, 2, 3, 4]);
    expect(out).toEqual([2, 3, 4, 1]);
  });

  it('formatDuration formate les secondes en m:ss', () => {
    expect(formatDuration(65)).toBe('1:05');
  });
});
