import { describe, it, expect } from 'vitest';
import { audioHash, textHash } from '../audioHash';

describe('audioHash : voix et texte converti', () => {
  it('porte sur la voix et sur le texte tel qu\'il est envoyé à la synthèse', async () => {
    expect(await audioHash('adrien', 'Il a 90 ans.')).toBe(await textHash('adrien|Il a nonante ans.'));
  });
  it('change avec la voix', async () => {
    expect(await audioHash('adrien', 'Le chat dort.')).not.toBe(await audioHash('jef', 'Le chat dort.'));
  });
  it('change avec le texte', async () => {
    expect(await audioHash('adrien', 'Le chat dort.')).not.toBe(await audioHash('adrien', 'Le chat dort!'));
  });
  it('est identique pour « 90 » et « nonante » (même audio)', async () => {
    expect(await audioHash('adrien', 'Il a 90 ans.')).toBe(await audioHash('adrien', 'Il a nonante ans.'));
  });
});
