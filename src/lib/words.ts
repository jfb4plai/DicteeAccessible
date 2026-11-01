// Séparateurs : retour à la ligne, point-virgule, virgule, tiret entouré d'espaces.
// Les traits d'union internes (peut-être) ne séparent pas.
const SEPARATORS = /\r?\n|;|,|\s[-–—]\s/;

export function parseWordList(raw: string): { words: string[]; duplicates: string[] } {
  const words: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  for (const part of raw.split(SEPARATORS)) {
    const word = part.trim().normalize('NFC'); // forme composée : une lettre accentuée = un caractère
    if (!word) continue;
    const key = word.normalize('NFC').toLowerCase();
    if (seen.has(key)) {
      duplicates.push(word);
    } else {
      seen.add(key);
      words.push(word);
    }
  }
  return { words, duplicates };
}
