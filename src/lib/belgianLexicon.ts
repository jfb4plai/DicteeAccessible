// Mots que les voix ElevenLabs lisent « à la française » et qu'une respelling corrige.
// Fichier de données : une entrée n'est ajoutée qu'après écoute et validation par JF ou une enseignante belge.
// Clés en minuscules. Valide à l'oreille le 2026-11-01 (Adrien, Christophe Géradon) : wagon, Wallonie, wallon.
export const LEXICON: Record<string, string> = {
  wagon: 'ouagon',
  wagons: 'ouagons',
  wallonie: 'ouallonie',
  wallon: 'ouallon',
  wallons: 'ouallons',
  wallonne: 'ouallonne',
  wallonnes: 'ouallonnes',
};
