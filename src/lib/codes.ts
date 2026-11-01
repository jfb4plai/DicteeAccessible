// 32 caractères, sans O, 0, I, 1 (lisibles pour un enfant). 256 est un multiple de 32 : le tirage par modulo est sans biais.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function secureRandomInt(max: number): number {
  return crypto.getRandomValues(new Uint8Array(1))[0] % max;
}

export function generateAccessCode(randomInt: (max: number) => number = secureRandomInt): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function nextPupilCodes(existing: string[], count: number): string[] {
  const highest = existing.reduce((max, code) => {
    const n = Number(/^E(\d+)$/i.exec(code.trim())?.[1] ?? 0);
    return Math.max(max, n);
  }, 0);
  return Array.from({ length: count }, (_, i) => `E${highest + i + 1}`);
}
