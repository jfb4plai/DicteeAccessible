import { describe, it, expect } from 'vitest';
import { SPEED_DEFAULT, SPEED_FASTER, SPEED_SLOWEST } from '../speed';

describe('vitesses d\'écoute', () => {
  it('la vitesse par défaut est plus lente que la voix naturelle, la plus lente est à 50 %', () => {
    expect(SPEED_DEFAULT).toBe(0.75);
    expect(SPEED_FASTER).toBe(1);
    expect(SPEED_SLOWEST).toBe(0.5);
    expect(SPEED_SLOWEST).toBeLessThan(SPEED_DEFAULT);
    expect(SPEED_DEFAULT).toBeLessThan(SPEED_FASTER);
  });
});
