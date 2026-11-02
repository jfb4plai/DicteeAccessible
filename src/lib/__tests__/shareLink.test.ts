import { describe, it, expect } from 'vitest';
import { TOKEN_PATTERN, buildShareUrl, parseShareToken, defaultShareExpiry, buildInviteMailto } from '../shareLink';

const T = 'A'.repeat(20) + 'b'.repeat(20) + '-_9';

describe('jeton et lien', () => {
  it('le jeton de test respecte le format', () => {
    expect(T).toHaveLength(43);
    expect(TOKEN_PATTERN.test(T)).toBe(true);
  });
  it('buildShareUrl place le jeton dans le fragment', () => {
    expect(buildShareUrl('https://x.app', T)).toBe(`https://x.app/suivi#t=${T}`);
  });
  it('parseShareToken relit un fragment valide', () => {
    expect(parseShareToken(`#t=${T}`)).toBe(T);
  });
  it.each(['', '#t=', '#t=court', `#t=${T}x`, `#t=${T.slice(0, 40)}+/=`, `#autre=${T}`, `t=${T}`])('refuse %s', hash => {
    expect(parseShareToken(hash)).toBeNull();
  });
});

describe('defaultShareExpiry', () => {
  const ymd = (d: Date) => [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
  it.each([
    [new Date(2026, 10, 2), [2027, 7, 31, 23, 59, 59]],
    [new Date(2027, 2, 15), [2027, 7, 31, 23, 59, 59]],
    [new Date(2027, 7, 31, 9, 0), [2027, 7, 31, 23, 59, 59]],
    [new Date(2027, 8, 1), [2028, 7, 31, 23, 59, 59]],
  ])('%s', (now, expected) => {
    expect(ymd(defaultShareExpiry(now as Date))).toEqual(expected);
  });
});

describe('buildInviteMailto', () => {
  const url = `https://x.app/suivi#t=${T}`;
  const mailto = buildInviteMailto(url, 'Ergo, Mme Dupont');
  const decoded = decodeURIComponent(mailto);
  it('est un lien mailto sans destinataire', () => {
    expect(mailto.startsWith('mailto:?subject=')).toBe(true);
  });
  it('contient le lien encodé et le libellé', () => {
    expect(mailto).toContain(encodeURIComponent(url));
    expect(decoded).toContain('Ergo, Mme Dupont');
  });
  it('dit lecture seule et ne pas transmettre, sans code élève', () => {
    expect(decoded).toContain('lecture seule');
    expect(decoded).toContain('ne le transmettez pas');
    expect(decoded).not.toMatch(/\bE\d+\b/);
  });
});
