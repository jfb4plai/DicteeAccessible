# Réglage du nombre de mots parasites par dictée (conception courte)

Date : 2026-11-24. Statut : brouillon, approbation de JF pendante. Rien codé, aucune migration appliquée.

## Intention
L'enseignant(e) règle, pour chaque dictée, combien de mots parasites (0 à 3) s'ajoutent aux tuiles en B2 et en classe. Elle peut demander à l'IA des parasites proches par le son, par l'orthographe, ou les deux. 0 = remise en ordre pure, utile pour un élève ralenti ou fatigable.

## État actuel (lu dans le code)
- Parasites stockés par phrase (`dicta_sentences.parasites`), proposés par Haiku (2 par phrase, `sentenceGeneration.ts`), relus par l'enseignant(e) (`SessionSentences.tsx`).
- Plafond fixe `MAX_PARASITES = 4` (`sentences.ts`). B1 : aucun parasite (`sentenceForStage`).
- Aucun réglage global.

## Buts / non-buts
- But : un réglage par dictée, appliqué à l'écran élève sans régénérer les phrases.
- Non-but : réglage par élève (écarté par JF le 2026-11-24).
- Anti-but : annoncer que la proximité est garantie. Le code ne peut vérifier que « différent d'un mot de la phrase ».

## Approche retenue (B, choisie par JF)
Colonne `dicta_sessions.parasite_count smallint not null default 2 check (parasite_count between 0 and 3)`.
- À la lecture côté élève, on garde les N premiers parasites de chaque phrase (`sentenceForStage` reçoit N).
- Le RPC d'ouverture de session (celui qui renvoie `voice` et `options`) renvoie aussi `parasite_count`.
- Écartée : approche A (réglage à la génération seulement, sans migration) : N ne se change pas après coup.

## Génération
- Haiku propose toujours 3 parasites par phrase (le maximum), pour que N puisse monter après coup.
- Option « Proximité » (aucune / phonétique / orthographique / les deux) : consigne ajoutée au prompt, utilisée à la génération seulement, non stockée.
- `MAX_PARASITES` passe de 4 à 3. Les parasites déjà enregistrés au-delà de 3 sont ignorés (les N premiers seuls servent).
- L'ordre des parasites compte : le champ texte garde l'ordre saisi, les N premiers sont utilisés. L'aide du champ le dit.

## Interface
- Sélecteur « Mots parasites par phrase : 0 / 1 / 2 / 3 » dans la création de dictée et sur la page des phrases, avec label, exemple et texte d'aide (impact sur B2 et la classe, B1 inchangé).
- Sélecteur de proximité près du bouton de génération.
- L'écran enseignant affiche « N utilisés sur M saisis ».

## Contraintes
- Migration SQL : accord de JF requis avant application ; test SQL dans `supabase/tests/`. Grants inchangés (colonne ajoutée à une table existante).
- Ordre : appliquer le SQL, puis pousser (sinon le site appelle une colonne absente).
- `npx vite build` avant `git push`.

## À la charge du constructeur
Écriture exacte du RPC modifié (reprendre la fonction existante en `create or replace`), tests unitaires (découpe à N, 0, plafond 3, prompt de proximité), mise à jour du mode d'emploi.

## Non vérifiable par code
Qualité phonétique/orthographique des parasites de Haiku : à juger par JF sur un vrai appel.
