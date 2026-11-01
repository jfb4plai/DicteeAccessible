# DictéeAccessible, plan 2 : phrases (IA), B1, B2, autodictée

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'enseignant(e) obtient des phrases proposées par l'IA (ou écrit les siennes), les relit et valide une par une, publie ; l'élève les passe en tuiles de mots (B1 phrase visible, B2 phrase cachée avec parasites) ; en classe, l'autodictée se fait en B2 avec un seul essai.

**Architecture:** Même dépôt que le plan 1. Logique pure dans `src/lib/*` (tests Vitest). Une fonction Vercel `api/generate-sentences.ts` appelle Claude Haiku 5.5 en sortie structurée, vérifie le jeton Supabase de l'enseignant(e) et un plafond quotidien (fonction SQL), puis renvoie des phrases contrôlées par code. L'élève lit toujours via les fonctions SQL `security definer`. Aucune clé dans le navigateur.

**Tech Stack:** celui du plan 1 + `@anthropic-ai/sdk` (côté fonction seulement).

**Spec:** `docs/superpowers/specs/2026-11-01-dicteeactif-design.md` §4.1, §4.2, §4.4, §5, §7. Le plan 1 (`docs/superpowers/plans/2026-11-01-dicteeaccessible-plan-1-socle.md`) est exécuté. Hors de ce plan : voix ElevenLabs et règle des nombres (plan 3), accès externe, vignette portail, mode d'emploi.

## Global Constraints

- Branche `main`. `npx vite build` et `npm test` passent avant tout push. Messages de commit terminés par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Tables préfixées `dicta_`, RLS et `GRANT` dans la même migration, `revoke all ... from anon, authenticated` avant les `grant`. SQL montré à JF avant application.
- Modèle : `claude-haiku-5-5`, sortie structurée par `output_config.format` (type `json_schema`), `output_config.effort: "low"`, jamais de `temperature`/`top_p`/`top_k`. Via le SDK `@anthropic-ai/sdk` (`client.messages.create`).
- `ANTHROPIC_API_KEY` : variable Vercel Production déjà posée par JF ; jamais dans le code, un log ou une réponse. Aucun `console.log` de mots, de phrases ou de contexte de classe.
- Imports depuis `api/*.ts` vers `src/lib/*.ts` avec l'extension `.js` (projet `"type": "module"`), sinon `FUNCTION_INVOCATION_FAILED`.
- Test de la fonction : `vercel dev` (pas `vite dev`, qui ne sert pas `/api`).
- Interface : Arial, 16 px minimum, DM Sans pour les titres, aucune police à empattements, branding PLAI. Chaque champ : label, placeholder concret, aide sur l'effet. Vocabulaire FWB (P1 à P6). Consignes élèves à l'infinitif, une action par puce. « enseignant(e) » dans les textes.
- IA déclaudisée : la fonction ne renvoie que des phrases, jamais de préambule. Split 80/20 : rien n'est publié tant que chaque phrase n'est pas validée par l'enseignant(e).
- Codes anonymes uniquement ; aucun prénom dans une phrase générée (consigne dans le prompt, vérifiée par le contrôle `prénom probable` : voir Task 4).

## Décisions que ce plan prend (à valider par JF, notées comme rulings)

1. **Parcours.** Séance « mots » : A puis C (inchangé). Séance « mots + phrases » en autonomie : A, B1, B2, C. Séance « phrases » (autodictée en classe) : B2 seulement, **un seul essai par phrase, sans indication de position** (comme le dernier tour). En autonomie, B1 et B2 gardent le retour immédiat avec cases fausses en rouge et nouvel essai.
2. **Verrou.** Une phrase n'est proposée que si chaque mot de la liste qu'elle contient a une réponse juste à l'étape A (spec §4.1).
3. **Longueur maximale** d'une phrase générée, en mots : P1 6, P2 8, P3 10, P4 12, P5 14, P6 16. Au-delà : signalée, jamais supprimée.
4. **Plafond IA** : 30 appels par enseignant(e) et par jour (UTC), 40 mots maximum par appel.
5. **Parasites** : 2 par phrase proposés par l'IA, 4 au maximum, jamais égaux à un mot de la phrase (vérifié par code).

## Review Focus

1. Phrase générée sans le mot cible, trop longue, avec un parasite égal à un mot de la phrase : signalée ou filtrée, jamais présentée comme sûre (Task 4).
2. Publication sans validation de toutes les phrases : refusée par l'interface et par la base (Tasks 3, 5).
3. IA indisponible, plafond atteint, JSON invalide : message clair, saisie manuelle toujours possible (Tasks 4, 5).
4. Ponctuation, majuscule, apostrophe, trait d'union dans une phrase (« L'été est là. », « peut-être, ») : tuiles et comparaison justes (Task 1).
5. Rechargement pendant B1 ou B2 : reprise à la bonne étape, essais de phrases en attente rejoués (Tasks 2, 6).

## File Structure

- `src/lib/sentences.ts`, `tileExercise.ts`, `sentenceGeneration.ts` : logique pure. `src/lib/progress.ts` (étendu), `pendingRows.ts` (étendu), `types.ts` (étendu), `api.ts` (étendu).
- `api/generate-sentences.ts` : fonction Vercel.
- `supabase/migrations/20261102120000_dicta_sentences.sql`, `supabase/tests/dicta_sentences_test.sql`.
- `src/pages/SessionSentences.tsx`, `src/components/SentenceExercise.tsx` ; `NewSession.tsx`, `PupilExercise.tsx`, `SessionResults.tsx` modifiés.

---

### Task 1: Phrases et tuiles (logique pure)

**Files:**
- Create: `src/lib/sentences.ts`, `src/lib/tileExercise.ts`
- Test: `src/lib/__tests__/sentences.test.ts`, `tileExercise.test.ts`

**Interfaces:**
- Produces (`sentences.ts`) :
  - `tokenizeSentence(text: string): string[]` : coupe sur les espaces, forme NFC, ponctuation collée au mot.
  - `stripPunctuation(token: string): string` : retire `. , ; : ! ? « » " ( )` en début et fin ; garde `'`, `’` et `-` internes.
  - `containsWord(sentence: string, word: string): boolean` : suite de jetons contigus, insensible à la casse et à la ponctuation (le mot peut avoir plusieurs jetons : « pomme de terre »).
  - `filterParasites(sentence: string, parasites: string[]): { kept: string[]; removed: string[] }` : retire vides, doublons, tout parasite égal (casse et ponctuation ignorées) à un jeton de la phrase ; garde 4 au plus.
  - `isCorrectSentenceAnswer(answerTokens: string[], sentence: string): boolean` : égalité des suites de jetons, NFC, insensible à la casse.
  - `type SentenceTile = { id: string; text: string; parasite: boolean }` ; `buildSentenceTiles(s: { text: string; parasites: string[] }, rng?: () => number): SentenceTile[]` : jetons (`t0`, `t1`…) plus parasites (`p0`…), mélangés.
  - `sentenceUnlocked(s: DictaSentence, items: DictaItem[], rows: AttemptRow[]): boolean`.
  - `maxWords(level: string): number` (valeurs de la décision 3) ; `sentenceTooLong(text: string, level: string): boolean`.
- Produces (`tileExercise.ts`) : `type TileState = { tokens: string[]; pool: SentenceTile[]; slots: (SentenceTile | null)[]; phase: 'placing' | 'ready' | 'right' | 'wrong'; attemptCount: number; wrongIdx: number[] }` ; `createTileExercise(s, rng?)` ; `tileReducer(state, action)` avec les actions `{ type: 'place'; poolIndex: number } | { type: 'unplace'; slot: number } | { type: 'validate' } | { type: 'retry' }`. Même contrat que `exerciseReducer` du plan 1 : `place` remplit la première case vide, `ready` quand toutes les cases sont pleines (les parasites restent dans le pool), `validate` seulement en `ready`, `retry` seulement en `wrong`.
- Consumes : `DictaSentence` (Task 2, Step 1 ; exécuter ce Step avant cette tâche).

- [ ] **Step 1: Write the failing tests**
  - `tokenizeSentence('  Le vent  a soufflé fort. ')` → `['Le','vent','a','soufflé','fort.']`.
  - `containsWord('Le vent a soufflé fort.', 'fort')` vrai ; `('Le vent a soufflé fort.', 'souffler')` faux ; `('Il boit, peut-être, de l\'eau.', 'peut-être')` vrai ; `('Il mange une pomme de terre.', 'pomme de terre')` vrai.
  - `filterParasites('Le vent a soufflé fort.', ['souffler','soufflez','soufflé','Fort','souffler'])` → `kept ['souffler','soufflez']`, `removed ['soufflé','Fort','souffler']`.
  - `isCorrectSentenceAnswer(['Le','vent','a','soufflé','fort.'], 'Le vent a soufflé fort.')` vrai ; deux jetons échangés faux ; `['le', …]` en minuscule vrai.
  - `buildSentenceTiles({ text: 'Le vent a soufflé fort.', parasites: ['souffler','soufflez'] })` : 7 tuiles, 2 avec `parasite: true`, identifiants uniques.
  - `sentenceUnlocked` : phrase « Le vent a soufflé fort. » avec l'item `soufflé` : faux sans ligne A juste, vrai avec `{ stage: 'A', kind: 'attempt', correct: true }` ; vrai si aucun item n'apparaît dans la phrase.
  - `maxWords('P1')` 6, `('P3')` 10, `('P6')` 16 ; `sentenceTooLong('Le vent a soufflé très fort sur la colline hier soir.', 'P1')` vrai.
  - `tileReducer` : phrase à 5 jetons + 2 parasites, placer les 5 bons jetons (retrouvés par `pool.findIndex`) donne `ready` puis `right` ; un jeton parasite à la place donne `wrong` avec la bonne position dans `wrongIdx` ; `retry` vide les cases et remet les jetons dans le pool ; `unplace` rend le jeton au pool ; `place` quand tout est rempli ne change rien.
  - Phrase « L'été est là. » : jetons `["L'été",'est','là.']`, comparaison correcte avec une apostrophe typographique `’` dans la phrase et la réponse.
- [ ] **Step 2:** Run `npm test -- sentences tileExercise` : FAIL (modules absents).
- [ ] **Step 3:** Implémenter les deux fichiers selon le bloc Interfaces.
- [ ] **Step 4:** Run `npm test` : PASS. Commit `feat: phrases, tuiles et verrou`.

---

### Task 2: Types et progression par étapes (logique pure)

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/progress.ts`, `src/lib/pendingRows.ts`, `src/lib/apiMapping.ts`
- Test: `src/lib/__tests__/progress.test.ts`, `pendingRows.test.ts`, `api.test.ts`

**Interfaces:**
- Produces (`types.ts`) : `type DictaSentence = { id: string; position: number; text: string; parasites: string[]; itemId: string | null }` ; `OpenedSession.sentences: DictaSentence[]` ; `AttemptRow.sentenceId?: string | null` (et `itemId` reste présent ; vide `''` pour une ligne de phrase) ; `SaveJob` reçoit `| { kind: 'sentence'; sentenceId: string; stage: 'B1' | 'B2'; answer: string; listens: number }`.
- Produces (`progress.ts`) :
  - `type Step = { stage: 'A' | 'B1' | 'B2' | 'C'; item?: DictaItem; sentence?: DictaSentence }`
  - `nextStep(ctx: { items: DictaItem[]; sentences: DictaSentence[]; rows: AttemptRow[]; mode: 'autonomy' | 'class'; finalRound: boolean }): Step | null` : ordre A (mots sans réponse juste), puis B1 (autonomie seulement, phrases déverrouillées sans B1 juste), puis B2 (phrases déverrouillées ; autonomie : sans B2 juste ; classe : sans aucun essai B2), puis C (comme `nextTask`, seulement s'il y a des mots).
  - `type SentenceSummary = { sentenceId: string; text: string; status: ItemStatus; label: string; firstAnswer: string | null; attempts: number }` ; `summarizeSentence(s: DictaSentence, rows: AttemptRow[], mode: 'autonomy' | 'class'): SentenceSummary` : gris `non fait` ; vert `réussie du premier coup` (premier essai B2 juste) ; orange `reprise` (B2 juste après des essais) ou `en cours` ; rouge `non réussie` (classe, premier essai B2 faux).
- Produces (`pendingRows.ts`) : `applyPendingJobs(rows, jobs, items, sentences?)` : un job `sentence` ajoute une ligne `{ sentenceId, stage, kind: 'attempt', attemptNumber, correct }` (justesse par `isCorrectSentenceAnswer` sur `answer.split(' ')` — la réponse est les jetons joints par une espace).
- Produces (`apiMapping.ts`) : `toOpenedSession` lit `sentences` (liste vide si absente) et `sentence_id` des lignes.

- [ ] **Step 1:** Ajouter les types ci-dessus à `types.ts` (le build doit rester vert).
- [ ] **Step 2: Write the failing tests**
  - `nextStep` autonomie, mots + phrases : A d'abord ; après A, la première phrase en B1 ; après B1 juste pour toutes, B2 ; après B2 juste, C pour les mots non réussis du premier coup, puis `null`.
  - `nextStep` classe, phrases seules (`items: []`) : B2 d'abord, aucune étape B1 ; un premier essai B2 faux termine la phrase ; `null` quand toutes ont un essai.
  - `nextStep` ne propose pas une phrase verrouillée tant que son mot n'a pas de réponse A juste.
  - `summarizeSentence` : les quatre cas ci-dessus avec leurs étiquettes exactes.
  - `applyPendingJobs` avec un job `sentence` : numérotation continue et justesse calculée.
  - `toOpenedSession` : un JSON avec `sentences: [{ id, position, text, parasites, item_id }]` et une ligne `{ sentence_id }` ; sans `sentences`, liste vide.
- [ ] **Step 3:** Run `npm test` : FAIL. Implémenter ; `nextTask` du plan 1 reste exporté et inchangé.
- [ ] **Step 4:** Run `npm test` et `npm run typecheck` : PASS. Commit `feat: progression A, B1, B2, C`.

---

### Task 3: Schéma SQL des phrases, verrou de publication, plafond IA

**Files:**
- Create: `supabase/migrations/20261102120000_dicta_sentences.sql`, `supabase/tests/dicta_sentences_test.sql`

**Interfaces:**
- Produces (contrat SQL) :
  - Table `dicta_sentences(id uuid pk, session_id fk cascade, item_id uuid null fk dicta_items on delete set null, position int, text text, parasites text[] not null default '{}', validated boolean not null default false, created_at)` ; RLS par la dictée de l'enseignant(e) (même forme que `dicta_items`), `grant` sur `authenticated`, `revoke` sur `anon`.
  - `dicta_attempts` : `item_id` devient nullable, colonne `sentence_id uuid references dicta_sentences on delete cascade`, contrainte `check ((item_id is null) <> (sentence_id is null))`.
  - Déclencheur `BEFORE UPDATE` sur `dicta_sessions` : si `published` passe de faux à vrai et qu'une phrase de la dictée n'est pas `validated`, lève `sentences_not_validated`.
  - `dicta_open_session` remplacée : ajoute `'sentences'` (phrases `validated` seulement, triées par `position`, avec `id, position, text, parasites, item_id`) et `sentence_id` dans chaque ligne de `'attempts'` ; le reste inchangé (pas de `title`).
  - `dicta_record_sentence_attempt(p_access_code text, p_pupil_code text, p_sentence_id uuid, p_stage text, p_answer text, p_listens int) returns jsonb` `{correct, attempt_number}` : refuse une phrase d'une autre dictée ou non validée (`invalid_access`), un `p_stage` autre que `B1`/`B2` (`invalid_stage`), applique le plafond de 1000 lignes ; justesse : `lower(normalize(regexp_replace(btrim(p_answer), '\s+', ' ', 'g'), NFC))` égal à la même normalisation de `text`.
  - `dicta_ai_usage(user_id uuid, day date, calls int, primary key (user_id, day))` avec RLS en lecture propriétaire seulement ; `dicta_ai_take(p_max int) returns int` (`security definer`, `authenticated` seulement, utilise `auth.uid()`) : incrémente l'appel du jour (UTC) et le renvoie, ou lève `quota_exceeded` si `p_max` serait dépassé.
- Consumes : tables et fonctions du plan 1.

- [ ] **Step 1: Write the failing test** `dicta_sentences_test.sql` dans `begin; ... rollback;`, avec les assertions : publier une dictée dont une phrase n'est pas validée lève `sentences_not_validated` ; après validation, la publication passe ; `dicta_open_session` ne renvoie pas une phrase non validée ; réponse `'Le vent a soufflé fort.'` renvoie `correct=true`, `'fort. Le vent a soufflé'` renvoie `false`, espaces multiples tolérés ; une phrase d'une autre dictée lève `invalid_access` ; `p_stage='A'` lève `invalid_stage` ; `dicta_ai_take(2)` renvoie 1 puis 2 puis lève `quota_exceeded` ; un autre utilisateur ne voit aucune ligne de `dicta_ai_usage` ; `anon` ne peut pas appeler `dicta_ai_take`.
- [ ] **Step 2:** Écrire la migration selon le bloc Interfaces (en-tête de commentaire sur le préfixe et le partage du projet).
- [ ] **Step 3:** **Montrer le SQL à JF et attendre son accord.** Puis appliquer avec `npx supabase db query --linked --project-ref otiorljbujqzruulmqrs -f <fichier>` (CLI déjà connecté), exécuter `dicta_sentences_test.sql` et un contrôle des droits (comme au plan 1).
- [ ] **Step 4:** Commit `feat: schéma des phrases et plafond IA`.

---

### Task 4: Génération des phrases par l'IA

**Files:**
- Create: `src/lib/sentenceGeneration.ts`, `api/generate-sentences.ts`
- Modify: `package.json` (dépendance `@anthropic-ai/sdk`, version épinglée)
- Test: `src/lib/__tests__/sentenceGeneration.test.ts`

**Interfaces:**
- Produces (`sentenceGeneration.ts`, pur) :
  - `type GenerateInput = { words: string[]; level: 'P1'|'P2'|'P3'|'P4'|'P5'|'P6'; rule?: string; context?: string }`
  - `validateGenerateInput(raw: unknown): { ok: true; value: GenerateInput } | { ok: false; error: string }` : 1 à 40 mots de 60 caractères au plus, règle et contexte de 300 au plus, niveau parmi P1 à P6.
  - `SENTENCE_SCHEMA` : JSON Schema `{ sentences: [{ word: string, text: string, parasites: string[] }] }`, `additionalProperties: false`, tous les champs requis.
  - `buildSystemPrompt(input: Pick<GenerateInput, 'level' | 'rule' | 'context'>): string` et `buildUserPrompt(words: string[]): string`. Le prompt système dit : français de Belgique, école FWB, niveau demandé, une phrase courte par mot qui contient le mot **tel qu'écrit**, vocabulaire du contexte de classe si fourni, deux parasites par phrase (si la règle est « é ou er » : d'autres formes du même verbe ; sinon des mots proches de forme), aucun prénom, aucune explication, JSON seulement.
  - `type GeneratedSentence = { word: string; text: string; parasites: string[]; removedParasites: string[]; flags: ('mot_absent' | 'trop_longue' | 'prenom_probable')[] }` ; `postProcessSentences(raw: unknown, words: string[], level: string): { sentences: GeneratedSentence[]; missing: string[] }` : ignore tout objet mal formé ; pose `mot_absent` si `containsWord` est faux, `trop_longue` si `sentenceTooLong`, `prenom_probable` si un jeton hors début de phrase commence par une majuscule et n'est pas un mot de la liste ; filtre les parasites avec `filterParasites` ; `missing` liste les mots sans phrase exploitable.
- Produces (`api/generate-sentences.ts`) : `export default async function handler(req, res)` : méthode POST seulement (405) ; entête `Authorization: Bearer <jeton Supabase>` vérifié par `GET {VITE_SUPABASE_URL}/auth/v1/user` (401) ; entrée validée (400) ; plafond par `POST {VITE_SUPABASE_URL}/rest/v1/rpc/dicta_ai_take` avec le jeton de l'enseignant(e) et `{ p_max: 30 }` (429 + `{ error: 'quota' }` sur `quota_exceeded`) ; appel `client.messages.create({ model: 'claude-haiku-5-5', max_tokens: 4096, system, messages, output_config: { effort: 'low', format: { type: 'json_schema', schema: SENTENCE_SCHEMA } } })` ; réponse 200 `{ sentences, missing }` ; toute autre erreur côté IA : 502 `{ error: 'ia' }` sans détail ; refus (`stop_reason: 'refusal'`) : 502 `{ error: 'refus' }`. Aucun log du contenu.

- [ ] **Step 1: Write the failing tests** (sur les fonctions pures) :
  - `validateGenerateInput` : 0 mot, 41 mots, niveau `P7`, mot de 61 caractères refusés ; une entrée correcte acceptée.
  - `postProcessSentences` avec un JSON brut de 3 phrases : « Le vent a soufflé fort. » pour `soufflé` (parasites `['souffler','soufflez','soufflé']`) donne `parasites ['souffler','soufflez']` et `removedParasites ['soufflé']` ; une phrase sans le mot cible reçoit `mot_absent` ; « Le vent a soufflé très fort sur la colline hier soir. » en `P1` reçoit `trop_longue` ; « Léa mange une pomme. » reçoit `prenom_probable` ; un mot de la liste sans objet dans le JSON figure dans `missing` ; `postProcessSentences('pas du json', …)` renvoie `{ sentences: [], missing: <tous les mots> }`.
  - `buildSystemPrompt({ level: 'P3', rule: 'é ou er' })` contient `P3`, `é ou er` et l'interdiction des prénoms ; sans règle, ne contient pas « é ou er ».
- [ ] **Step 2:** Run `npm test -- sentenceGeneration` : FAIL.
- [ ] **Step 3:** Implémenter `sentenceGeneration.ts`, puis `api/generate-sentences.ts` (import avec extension `.js`), puis `npm install @anthropic-ai/sdk` (version épinglée dans `package.json`).
- [ ] **Step 4:** Run `npm test`, `npm run typecheck`, `npx vite build` : PASS.
- [ ] **Step 5:** `vercel dev` en local avec la clé tirée de l'environnement Vercel (`vercel env pull .env.local` n'est **pas** utilisé : la clé ne doit pas être écrite sur le disque de OneDrive ; tester plutôt après déploiement, Task 7). Noter dans le ledger : appel réel non testé avant Task 7.
- [ ] **Step 6:** Commit `feat: génération des phrases par l'IA`.

---

### Task 5: Écrans enseignant(e) des phrases

**Files:**
- Create: `src/pages/SessionSentences.tsx`
- Modify: `src/lib/api.ts`, `src/lib/sessionForm.ts`, `src/pages/NewSession.tsx`, `src/App.tsx`
- Test: `src/lib/__tests__/sessionForm.test.ts`

**Interfaces:**
- Produces (`api.ts`) : `generateSentences(input: GenerateInput): Promise<{ sentences: GeneratedSentence[]; missing: string[] }>` (jeton de session Supabase, `fetch('/api/generate-sentences')`, erreurs : `quota` → « Plafond du jour atteint. Écris tes phrases toi-même ou reviens demain. », `ia`/`refus` → « La proposition automatique n'est pas disponible. Écris tes phrases toi-même. ») ; `listSentences(sessionId: string): Promise<(DictaSentence & { validated: boolean })[]>` ; `saveSentences(sessionId: string, sentences: { id?: string; text: string; parasites: string[]; itemId: string | null; validated: boolean }[]): Promise<void>` (remplace l'ensemble) ; `publishSession(sessionId: string): Promise<void>` (met `published=true` ; l'erreur `sentences_not_validated` devient « Valide toutes les phrases avant de publier. »).
- Modifie `createSession(input)` : accepte `contents: 'words' | 'words+sentences' | 'sentences'`, crée la dictée avec `published: contents === 'words'` ; `SessionInput.contents` ajouté.
- Modifie `validateSessionInput` : nouveau champ `contents` ; les mots sont obligatoires sauf pour `sentences`.
- `SessionSentences` : route protégée `/enseignant/session/:id/phrases`. Trois zones : « Mots pour proposer des phrases » (préremplie avec les mots de la dictée, modifiable) + bouton « Proposer des phrases » ; liste modifiable des phrases (texte, parasites séparés par des virgules, case « Je valide cette phrase », bouton « Supprimer ») avec les avertissements de `flags` en clair ; bouton « Ajouter ma phrase ». Le bouton « Publier la dictée » est désactivé tant qu'une phrase n'est pas validée ou qu'il n'y en a aucune ; texte d'aide : « Rien n'est publié tant que tu n'as pas validé chaque phrase. » Une phrase dont le mot cible est absent ou trop longue ne peut pas être validée sans modification du texte (case grisée avec l'explication).
- `NewSession` : nouveau choix « Contenu de la dictée » (mots / mots et phrases / phrases) avec aide ; après création, si `contents !== 'words'`, navigation vers `/enseignant/session/:id/phrases`.

- [ ] **Step 1: Write the failing tests** : `validateSessionInput` avec `contents: 'sentences'` et `wordsText: ''` accepte ; avec `contents: 'words'` et `wordsText: ''` refuse (« Ajoute au moins un mot. ») ; `contents` inconnu refusé.
- [ ] **Step 2:** Run `npm test` : FAIL ; implémenter `sessionForm`, `api.ts`, les deux pages et la route ; `npm run typecheck` et `npx vite build` : PASS.
- [ ] **Step 3:** Commit `feat: écrans enseignant(e) des phrases`.

---

### Task 6: Écrans élève B1 et B2

**Files:**
- Create: `src/components/SentenceExercise.tsx`
- Modify: `src/pages/PupilExercise.tsx`, `src/lib/api.ts`
- Test: aucun nouveau test unitaire (la logique est dans les Tasks 1 et 2) ; vérification navigateur en Step 3.

**Interfaces:**
- Consumes : `nextStep`, `createTileExercise`, `tileReducer`, `SaveJob` (Tasks 1 et 2) ; `recordSentenceAttempt`.
- Produces (`api.ts`) : `recordSentenceAttempt(a: { accessCode: string; pupilCode: string; sentenceId: string; stage: 'B1' | 'B2'; answer: string; listens: number }): Promise<{ correct: boolean; attemptNumber: number }>` (appelle `dicta_record_sentence_attempt`).
- `SentenceExercise({ sentence, stage, mode, readAloud, progressLabel, onAttempt, onNext })` : B1 affiche la phrase ; B2 la cache (« Phrase cachée. Écouter la phrase. ») ; bouton « Écouter la phrase » (voix du navigateur, compte les écoutes) ; cases et tuiles ≥ 56 px, parasites non marqués ; B1/B2 en autonomie : cases fausses en rouge, relance automatique après 2 s, bouton « Réessayer maintenant » ; B2 en classe : un seul essai, « Réponse enregistrée. », pas de rouge, passage au suivant ; `onAttempt({ answer: tuiles jointes par une espace, correct, listens })`.
- `PupilExercise` : remplace `nextTask` par `nextStep` ; la file d'enregistrement envoie aussi les jobs `sentence` ; `applyPendingJobs` reçoit les phrases ; étiquette d'avancement « Phrase n sur N » ; l'écran de fin et le bandeau d'attente restent ceux du plan 1.

- [ ] **Step 1:** Implémenter le composant, l'appel API et l'orchestration.
- [ ] **Step 2:** Run `npm test`, `npm run typecheck`, `npx vite build` : PASS.
- [ ] **Step 3:** Vérification navigateur contre un faux serveur local (le script du plan 1 est à étendre : réponses `sentences` et `dicta_record_sentence_attempt`) : parcours autonomie A → B1 → B2 → C avec une faute en B2, rechargement en B1, coupure réseau pendant B2 ; parcours classe en B2 avec un essai faux. Noter dans le ledger : constaté / non vérifié.
- [ ] **Step 4:** Commit `feat: écrans élève B1 et B2`.

---

### Task 7: Résultats des phrases, recette et mise en ligne

**Files:**
- Modify: `src/pages/SessionResults.tsx`, `src/lib/api.ts` (`getResults` renvoie aussi les phrases), `docs/recette-plan-1.md` (renommé `docs/recette.md`, deux parties)
- Test: `src/lib/__tests__/progress.test.ts` (déjà couvert par Task 2)

- [ ] **Step 1:** `SessionResults` : section « Phrases » par élève (pastille, texte, étiquette de `summarizeSentence`, détail : premier essai, essais, écoutes) sous la liste des mots ; état vide « Aucune phrase dans cette dictée. »
- [ ] **Step 2:** Run `npm test`, `npm run typecheck`, `npx vite build` : PASS ; push sur `main` après le build.
- [ ] **Step 3:** Après déploiement, recette réelle avec le compte de JF (outil Chrome) : créer une dictée « mots et phrases » ; **appel réel de l'IA** (vérifie la clé Anthropic de Vercel : constaté ou non) ; vérifier qu'une phrase sans le mot cible est signalée ; que « Publier » est refusé tant qu'une phrase n'est pas validée (interface puis appel direct à la base) ; passer A, B1, B2, C côté élève ; lire les résultats ; nettoyer les données de test (comme au plan 1).
- [ ] **Step 4:** Mettre à jour la mémoire du projet ; demander à JF une recette sur tablette avant l'autodictée du 23/11.
