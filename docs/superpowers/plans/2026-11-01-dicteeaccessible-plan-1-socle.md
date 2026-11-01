# DictéeAccessible, plan 1 : socle (étape A, enregistrement mot par mot, résultats)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une enseignante crée une dictée de mots pour un ou plusieurs élèves (codes anonymes), l'élève la passe en lettres à placer avec retour immédiat, chaque réponse est enregistrée mot par mot, l'enseignante lit les résultats et écrit un commentaire.

**Architecture:** Copie de `projets/PLAI-French-Interactive-dictation` dans `projets/dicteeaccessible` (nouveau dépôt, l'original intact). Logique pure dans `src/lib/*` testée par Vitest ; écrans React minces. L'élève n'a aucun accès direct aux tables : il passe par deux fonctions SQL `security definer` (`dicta_open_session`, `dicta_record_attempt`, `dicta_record_help`). L'enseignante accède à ses données par RLS (`user_id = auth.uid()`). Pas de dossier `/api` dans ce plan (pas d'IA ni de voix ElevenLabs).

**Tech Stack:** React 18, Vite 5, TypeScript, Tailwind 3, Supabase v2, Vitest 2, html2canvas, qrcode (déjà dans la base).

**Spec:** `docs/superpowers/specs/2026-11-01-dicteeactif-design.md` (approuvée le 2026-11-01). Ce plan couvre §11 étape 1 ; il ne couvre pas B1, B2, phrases IA, voix ElevenLabs, accès externe, vignette portail, mode d'emploi (plans suivants).

## Global Constraints

- Branche `main`. `npx vite build` et `npm test` passent avant tout push. Messages de commit terminés par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Tables préfixées `dicta_`. Même migration : `create table`, RLS, `GRANT`. Aucune table lisible par `anon`. SQL montré à JF avant application (rien n'est appliqué sans son accord).
- Projet Supabase : celui de la base, `otiorljbujqzruulmqrs` ("Flashfwb"). **À confirmer par JF avant la Task 2** (le CLAUDE.md projet cite `dfoaumjleqtxjeaplnna`).
- Aucun prénom d'élève : code anonyme (E1, E2…) en base, en URL, en capture.
- Aucune clé dans le frontend ; aucun `console.log` de données utilisateur (retirer ceux d'`AuthContext`).
- Interface : Arial, 16 px minimum, branding PLAI (teal #0f6e56, orange #f97316), logo `public/plai-logo.jpg` avec hauteur fixée seulement (32 px nav, 40 px footer, largeur auto). Chaque champ : label, placeholder concret, aide sous le champ sur l'effet de la saisie.
- Vocabulaire FWB : niveaux P1 à P6. Consignes élèves à l'infinitif, une action par puce. Aucun tiret cadratin dans les textes du dépôt.
- Statuts affichés : jamais de note ; « réussis du premier coup » est une information.

## Review Focus

1. Mot avec accent, majuscule, trait d'union, apostrophe droite ou typographique (« Été », « peut-être », « aujourd’hui ») : comparaison et cases préremplies justes (Task 3).
2. Liste de mots mal saisie (lignes vides, doublons, tirets longs, espaces en trop) : pas de mot vide ni doublon (Task 3).
3. Élève qui recharge la page ou ferme l'onglet au milieu : reprise là où elle en était, sans refaire les mots déjà réussis (Tasks 4 et 7).
4. Code de session ou code élève inexistant, en minuscules, avec espaces : message neutre, aucune fuite sur ce qui existe (Tasks 2 et 7).
5. Échec réseau à l'enregistrement : la réponse n'est pas perdue, un message « enregistrement en attente » s'affiche, l'envoi reprend seul (Tasks 4 et 7).

Limite connue, non traitée : le code élève (E1…) étant court, un camarade qui connaît le code de session peut ouvrir la session d'un autre élève. À durcir (jeton par élève) dans un plan ultérieur.

## File Structure

- `src/lib/types.ts` : types partagés (Task 5).
- `src/lib/words.ts`, `letters.ts`, `letterExercise.ts`, `progress.ts`, `saveQueue.ts`, `codes.ts`, `sessionForm.ts` : logique pure, un fichier par responsabilité (Tasks 3, 4, 6). Tests dans `src/lib/__tests__/`.
- `src/lib/api.ts` : seul module qui parle à Supabase (Task 5).
- `src/pages/` : `TeacherDashboard`, `PupilsPage`, `NewSession`, `SessionResults`, `PupilEntry`, `PupilExercise`. Conservés tels quels : `Home`, `TeacherAuth`, `ResetPassword`, `ProtectedRoute`, `AuthContext`, `speech.ts`.
- `supabase/migrations/20261101120000_dicta_tables.sql`, `supabase/tests/dicta_rpc_test.sql`.

---

### Task 1: Amorçage du dépôt

**Files:**
- Create: dépôt `projets/dicteeaccessible` (code copié), `.env.example`, `README.md`
- Modify: `package.json`, `vite.config.ts`, `src/contexts/AuthContext.tsx`, `src/App.tsx`, `index.html`
- Delete (dans la copie) : `src/components/CreateSession.tsx`, `SessionCreated.tsx`, `src/pages/SessionDetails.tsx`, `StudentEntry.tsx`, `StudentGame.tsx`, `TeacherDashboard.tsx`, `TeacherResults.tsx`, `dist/`, `dist.tar.gz`, `.vercel/`, `supabase/.temp/`, `supabase/migrations/*` de la base, `.bolt/`
- Test: `src/lib/__tests__/utils.test.ts`

**Interfaces:**
- Produces: script `npm test` (Vitest, environnement node, `src/**/*.test.ts`) ; `shuffleArray<T>(a: T[], rng?: () => number): T[]` dans `src/lib/utils.ts`.

- [ ] **Step 1:** Copier `projets/PLAI-French-Interactive-dictation` vers `projets/dicteeaccessible` (qui contient déjà `docs/` et `maquettes/`) sans `node_modules`, `.git`, `dist`, `dist.tar.gz`, `.vercel`, `supabase/.temp`, `.bolt` ; supprimer les fichiers listés ci-dessus ; `git init -b main`.
- [ ] **Step 2:** Renommer le paquet en `dicteeaccessible`, titre de page « DictéeAccessible » dans `index.html`, retirer les deux `console.log` d'`AuthContext`, ajouter `.env.example` (`VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=`), garder `LICENSE` et `LICENSE-CONTENT.md`, `README.md` d'une dizaine de lignes (but, lancement, tests).
- [ ] **Step 3:** Ajouter `vitest@^2.1` en devDependency, script `"test": "vitest run"`, bloc `test: { environment: 'node', include: ['src/**/*.test.ts'] }` dans `vite.config.ts` (import de `defineConfig` depuis `vitest/config`).
- [ ] **Step 4: Write the failing test** `utils.test.ts` : `shuffleArray([1,2,3,4], () => 0)` renvoie un tableau de mêmes éléments (tri égal à `[1,2,3,4]`) et n'altère pas l'entrée ; `formatDuration(65)` vaut `'1:05'`.
- [ ] **Step 5:** Run `npm test` : FAIL (`rng` non supporté ou fichier absent). Adapter `shuffleArray` pour accepter `rng` (défaut `Math.random`). Run `npm test` : PASS.
- [ ] **Step 6:** Remplacer les routes d'`App.tsx` par `/`, `/enseignant/auth`, `/enseignant/reinitialiser-mot-de-passe` (pages conservées) ; les autres routes arrivent avec leurs tâches. Run `npx vite build` : succès.
- [ ] **Step 7:** Commit `chore: amorçage DictéeAccessible depuis Dictée Interactive`.

---

### Task 2: Schéma SQL, fonctions élève, test SQL

**Files:**
- Create: `supabase/migrations/20261101120000_dicta_tables.sql`, `supabase/tests/dicta_rpc_test.sql`

**Interfaces:**
- Produces (tables, RLS propriétaire `user_id = (select auth.uid())` partout, aucune politique `anon`) :
  - `dicta_pupils(id uuid pk, user_id uuid, code text, created_at)` unique `(user_id, code)`.
  - `dicta_sessions(id uuid pk, user_id uuid, title text, level text check P1..P6, mode text check ('autonomy','class'), access_code text unique, show_correct boolean default false, read_aloud boolean default true, final_round boolean default true, published boolean default true, created_at)`.
  - `dicta_items(id uuid pk, session_id fk cascade, word text, position int)`.
  - `dicta_session_pupils(session_id fk cascade, pupil_id fk cascade, pk(session_id, pupil_id))`.
  - `dicta_attempts(id uuid pk, user_id uuid, session_id, pupil_id, item_id, stage text check ('A','B1','B2','C'), kind text check ('attempt','help'), attempt_number int, answer text null, correct boolean null, listens int default 0, screenshot text null, created_at)`.
  - `dicta_comments(id uuid pk, user_id uuid, session_id, pupil_id, body text, visible boolean default false, updated_at)` unique `(session_id, pupil_id)`.
- Produces (fonctions `security definer`, `set search_path = public`, `revoke all from public`, `grant execute to anon, authenticated`) :
  - `dicta_open_session(p_access_code text, p_pupil_code text) returns jsonb` : `{session_id, title, mode, options:{show_correct, read_aloud, final_round}, items:[{id, word, position}], attempts:[{item_id, stage, kind, attempt_number, correct}]}` ; lève `invalid_access` si code absent, élève non rattaché à la session ou session non publiée (même message dans les trois cas).
  - `dicta_record_attempt(p_access_code text, p_pupil_code text, p_item_id uuid, p_stage text, p_answer text, p_listens int, p_screenshot text) returns jsonb` `{correct boolean, attempt_number int}` : la justesse est calculée côté serveur (comparaison `lower(nfc)` avec le mot de l'item), `attempt_number` = nombre de lignes `kind='attempt'` du même (session, élève, item, étape) + 1, `user_id` copié de la session.
  - `dicta_record_help(p_access_code text, p_pupil_code text, p_item_id uuid, p_stage text) returns void` : insère une ligne `kind='help'`.
  - Les trois fonctions refusent un `p_item_id` qui n'appartient pas à la session.
- Grants : `authenticated` select/insert/update/delete sur les tables d'enseignante ; `dicta_attempts` select seulement pour `authenticated` ; `service_role` tout.

- [ ] **Step 1:** Contrôle de collision : `grep -rIn "dicta_" --include=*.sql --exclude-dir=node_modules .` depuis la racine du workspace (attendu : seulement ce dépôt) et, après accord de JF sur le projet cible, requête `select table_name from information_schema.tables where table_name like 'dicta\_%'` (attendu : 0 ligne).
- [ ] **Step 2: Write the failing test** `supabase/tests/dicta_rpc_test.sql`, entièrement dans `begin; ... rollback;` : crée un utilisateur, un élève `E1`, une session avec l'item `chat`, puis vérifie : `dicta_open_session('XXXXXX','E1')` lève `invalid_access` ; `dicta_open_session(code,'E2')` lève `invalid_access` ; `dicta_record_attempt(..., 'chta', ...)` renvoie `correct=false, attempt_number=1` ; avec `'CHAT'` renvoie `correct=true, attempt_number=2` ; `dicta_record_help` ajoute une ligne `kind='help'` ; `dicta_open_session` renvoie ensuite 3 lignes dans `attempts` ; un second utilisateur ne voit aucune ligne de `dicta_attempts` (rôle `authenticated`, autre `sub`) ; `anon` ne peut pas faire `select` sur `dicta_sessions`.
- [ ] **Step 3:** Écrire la migration selon le bloc Interfaces ; en-tête de commentaire expliquant le préfixe et le partage du projet.
- [ ] **Step 4:** **Montrer le SQL à JF et attendre son accord.** Puis l'appliquer (éditeur SQL du projet ou CLI Supabase), puis exécuter `dicta_rpc_test.sql` : toutes les assertions passent et la transaction est annulée.
- [ ] **Step 5:** Commit `feat: schéma dicta_* et fonctions élève`.

---

### Task 3: Mots et lettres (logique pure)

**Files:**
- Create: `src/lib/words.ts`, `src/lib/letters.ts`
- Test: `src/lib/__tests__/words.test.ts`, `letters.test.ts`

**Interfaces:**
- Produces:
  - `parseWordList(raw: string): { words: string[]; duplicates: string[] }` : sépare sur retour à la ligne, `;`, `,` et tiret entouré d'espaces (`-`, `–`, `—`) ; garde les traits d'union internes ; supprime vides et doublons (insensible à la casse, garde la première occurrence, renvoie les doublons écartés tels que saisis).
  - `isCorrectAnswer(answer: string, expected: string): boolean` : compare après `normalize('NFC')` et `toLowerCase()`.
  - `autoPrefilledIndices(word: string): number[]` : indices de `-`, `'`, `’` et espace.
  - `buildLetterPool(word: string, rng?: () => number): string[]` : lettres sans les caractères préremplis, mélangées.
  - `wrongPositions(placed: (string | null)[], expected: string): number[]` : indices différents (comparaison minuscule, `null` = faux).

- [ ] **Step 1: Write the failing tests**
  - `parseWordList('monsieur – droit – lendemain')` → `words` égal à `['monsieur','droit','lendemain']`.
  - `parseWordList("peut-être\naujourd'hui;Été, chaque")` → `['peut-être',"aujourd'hui",'Été','chaque']`.
  - `parseWordList('paire\n\n  paire \nPaire')` → `words ['paire']`, `duplicates ['paire','Paire']` ; `parseWordList('')` → `{words:[], duplicates:[]}`.
  - `isCorrectAnswer('Lendemain','lendemain')` vrai ; `isCorrectAnswer('lendemin','lendemain')` faux ; `isCorrectAnswer('éte','été')` vrai.
  - `autoPrefilledIndices("aujourd'hui")` → `[7]` ; `("aujourd’hui")` → `[7]` ; `('peut-être')` → `[4]` ; `('pomme de terre')` → `[5,8]`.
  - `buildLetterPool('été')` trié égal à `['t','é','é']` trié ; `buildLetterPool('peut-être').length` vaut 8.
  - `wrongPositions(['l','e','n',null],'lend')` → `[3]` ; `(['l','e','x','d'],'lend')` → `[2]`.
- [ ] **Step 2:** Run `npm test -- words letters` : FAIL.
- [ ] **Step 3:** Implémenter les cinq fonctions dans les deux fichiers (signatures ci-dessus). Les doublons de lettres dans `buildLetterPool` sont conservés.
- [ ] **Step 4:** Run `npm test` : PASS.
- [ ] **Step 5:** Commit `feat: analyse de liste de mots et règles de lettres`.

---

### Task 4: Exercice, progression, file d'enregistrement (logique pure)

**Files:**
- Create: `src/lib/letterExercise.ts`, `src/lib/progress.ts`, `src/lib/saveQueue.ts`
- Test: `src/lib/__tests__/letterExercise.test.ts`, `progress.test.ts`, `saveQueue.test.ts`

**Interfaces:**
- Consumes: `autoPrefilledIndices`, `buildLetterPool`, `isCorrectAnswer`, `wrongPositions` (Task 3) ; types `AttemptRow`, `DictaItem`, `Stage` de `src/lib/types.ts`. **Ordre :** exécuter d'abord le Step 1 de la Task 5 (écriture de `types.ts`), puis cette tâche.
- Produces:
  - `type ExerciseState = { word: string; pool: string[]; placed: (string | null)[]; prefilled: number[]; phase: 'placing' | 'ready' | 'right' | 'wrong'; attemptCount: number; wrongIdx: number[] }`
  - `type ExerciseAction = { type: 'place'; poolIndex: number } | { type: 'unplace'; slot: number } | { type: 'validate' } | { type: 'retry' }`
  - `createExercise(word: string, rng?: () => number): ExerciseState`
  - `exerciseReducer(state: ExerciseState, action: ExerciseAction): ExerciseState` : `place` remplit la première case vide non préremplie, passe en `ready` quand tout est rempli ; `unplace` rend la lettre au pool (case préremplie ignorée) ; `validate` (seulement en `ready`) passe en `right` ou `wrong` avec `wrongIdx` et `attemptCount + 1` ; `retry` (seulement en `wrong`) remet les cases à vide sauf préremplies, reconstruit le pool, `attemptCount` inchangé.
  - `type ItemStatus = 'green' | 'orange' | 'red' | 'grey'`
  - `type ItemSummary = { itemId: string; word: string; status: ItemStatus; label: string; firstAnswer: string | null; attemptsA: number; listens: number; helpUsed: boolean; screenshots: string[] }`
  - `summarizeItem(item: DictaItem, rows: AttemptRow[], finalRound: boolean): ItemSummary`
  - `summarizeSession(summaries: ItemSummary[]): { total: number; firstTry: number; toReview: number }` (`toReview` = orange + rouge).
  - `nextTask(items: DictaItem[], rows: AttemptRow[], finalRound: boolean): { stage: 'A' | 'C'; item: DictaItem } | null` : premier item (dans l'ordre reçu) sans ligne `attempt` correcte à l'étape A ; sinon, si `finalRound`, premier item non « premier coup » sans ligne correcte à l'étape C ; sinon `null`.
  - `createSaveQueue<T>(opts: { send: (job: T) => Promise<void>; schedule?: (fn: () => void, ms: number) => void; retryMs?: number; onChange?: (pending: number) => void }): { enqueue(job: T): void; pending(): number }` : envoi dans l'ordre, un à la fois ; en cas d'échec le job reste en tête et on réessaie après `retryMs` (défaut 3000).

Règles de `summarizeItem` (étiquettes exactes) :
- aucune ligne → gris, `non fait`.
- Premier essai de l'étape A correct et aucune ligne `help` → vert, `réussi du premier coup`.
- Sinon, début = `bonne orthographe montrée` si une ligne `help` existe, sinon `repris`. Fin selon l'étape C : premier essai C correct → orange `, maîtrisé au dernier tour` ; premier essai C faux → rouge `, non maîtrisé` ; pas de ligne C et `finalRound` → orange `, dernier tour non fait` ; pas de ligne C et pas `finalRound` → orange, rien.
- Aucun essai A correct et aucune aide → orange `en cours` (remplace la règle précédente).

- [ ] **Step 1: Write the failing tests**
  - `letterExercise` : `createExercise('chat')` en `placing`, `placed` de 4 `null`, `pool` trié `['a','c','h','t']` ; placer c,h,a,t via `pool.indexOf(lettre)` passe en `ready`, `validate` donne `right`, `attemptCount` 1 ; placer c,h,t,a puis `validate` donne `wrong` avec `wrongIdx [2,3]`, `retry` redonne `placing` avec 4 `null` et `attemptCount` 1 ; `createExercise("l'été")` a `prefilled [1]`, `placed[1]` vaut `"'"`, et `unplace` sur la case 1 ne change rien ; `place` quand tout est rempli ne change pas l'état.
  - `progress` : un test par ligne des règles ci-dessus (7 cas, dont `bonne orthographe montrée, maîtrisé au dernier tour` et `repris, dernier tour non fait`) ; `summarizeSession` sur 12 résumés dont 9 verts et 3 non verts non gris → `{total:12, firstTry:9, toReview:3}` ; `nextTask` : A d'abord, puis C seulement pour les non « premier coup », puis `null` ; avec `finalRound=false` renvoie `null` après A ; un rechargement (mêmes `rows`) reprend au bon item.
  - `saveQueue` : avec un `send` qui échoue deux fois puis réussit et un `schedule` manuel : `pending()` vaut 1 après `enqueue`, 1 après deux échecs, 0 après réussite ; deux jobs envoyés dans l'ordre d'insertion ; `onChange` appelé avec 1 puis 0.
- [ ] **Step 2:** Run `npm test` : FAIL.
- [ ] **Step 3:** Implémenter les trois fichiers selon le bloc Interfaces.
- [ ] **Step 4:** Run `npm test` : PASS.
- [ ] **Step 5:** Commit `feat: exercice en lettres, progression, file d'enregistrement`.

---

### Task 5: Types et accès aux données

**Files:**
- Create: `src/lib/types.ts`, `src/lib/api.ts`
- Modify: `src/lib/supabase.ts` (retirer les anciens types `Session`, `WordAttempt`, `StudentResult`)
- Test: `src/lib/__tests__/api.test.ts`

**Interfaces:**
- Produces (`types.ts`, à écrire en premier car Task 4 en dépend) :
  - `type Stage = 'A' | 'B1' | 'B2' | 'C'`
  - `type DictaItem = { id: string; word: string; position: number }`
  - `type AttemptRow = { itemId: string; stage: Stage; kind: 'attempt' | 'help'; attemptNumber: number; correct: boolean | null; answer?: string | null; listens?: number; screenshot?: string | null }`
  - `type SessionOptions = { showCorrect: boolean; readAloud: boolean; finalRound: boolean }`
  - `type OpenedSession = { sessionId: string; title: string; mode: 'autonomy' | 'class'; options: SessionOptions; items: DictaItem[]; attempts: AttemptRow[] }`
  - `type Pupil = { id: string; code: string }`
  - `type SessionInput = { title: string; level: 'P1'|'P2'|'P3'|'P4'|'P5'|'P6'; mode: 'autonomy' | 'class'; words: string[]; pupilIds: string[]; options: SessionOptions }`
  - `type SessionListItem = { id: string; title: string; level: string; mode: string; accessCode: string; wordCount: number; pupilCount: number; createdAt: string }`
  - `type CommentRow = { pupilId: string; body: string; visible: boolean }`
- Produces (`api.ts`, seul module important Supabase) :
  - `toOpenedSession(raw: unknown): OpenedSession` (mappage snake_case → camelCase du JSON de `dicta_open_session`, exporté pour test).
  - `openSession(accessCode: string, pupilCode: string): Promise<OpenedSession>` : normalise les codes (`trim`, majuscules) ; erreur `invalid_access` → `Error('Code inconnu')`.
  - `recordAttempt(a: { accessCode: string; pupilCode: string; itemId: string; stage: Stage; answer: string; listens: number; screenshot: string | null }): Promise<{ correct: boolean; attemptNumber: number }>`
  - `recordHelp(a: { accessCode: string; pupilCode: string; itemId: string; stage: Stage }): Promise<void>`
  - `listPupils(): Promise<Pupil[]>`, `createPupils(codes: string[]): Promise<Pupil[]>`
  - `createSession(input: SessionInput): Promise<{ id: string; accessCode: string }>` (code via `generateAccessCode`, Task 6 ; réessaie une fois en cas de collision d'unicité)
  - `listSessions(): Promise<SessionListItem[]>`
  - `getResults(sessionId: string): Promise<{ title: string; options: SessionOptions; items: DictaItem[]; pupils: Pupil[]; attempts: (AttemptRow & { pupilId: string })[]; comments: CommentRow[] }>`
  - `saveComment(sessionId: string, c: CommentRow): Promise<void>` (upsert sur `(session_id, pupil_id)`).

- [ ] **Step 1:** Écrire `types.ts` (bloc ci-dessus).
- [ ] **Step 2: Write the failing test** : `toOpenedSession` sur un JSON du type `{"session_id":"s1","title":"Dictée du 16/11","mode":"class","options":{"show_correct":false,"read_aloud":true,"final_round":true},"items":[{"id":"i1","word":"chat","position":0}],"attempts":[{"item_id":"i1","stage":"A","kind":"attempt","attempt_number":1,"correct":true}]}` renvoie `{sessionId:'s1', options:{showCorrect:false, readAloud:true, finalRound:true}, attempts:[{itemId:'i1', stage:'A', kind:'attempt', attemptNumber:1, correct:true}], ...}`.
- [ ] **Step 3:** Run `npm test -- api` : FAIL. Implémenter `api.ts`. Les erreurs Supabase brutes ne sont jamais montrées à l'élève.
- [ ] **Step 4:** Run `npm test` puis `npx vite build` : PASS.
- [ ] **Step 5:** Commit `feat: types et accès aux données`.

---

### Task 6: Codes et formulaire de session (logique pure)

**Files:**
- Create: `src/lib/codes.ts`, `src/lib/sessionForm.ts`
- Modify: `src/lib/utils.ts` (retirer l'ancien `generateAccessCode`)
- Test: `src/lib/__tests__/codes.test.ts`, `sessionForm.test.ts`

**Interfaces:**
- Produces:
  - `generateAccessCode(randomInt?: (max: number) => number): string` : 6 caractères dans `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sans O, 0, I, 1), tirage par `crypto.getRandomValues` par défaut.
  - `nextPupilCodes(existing: string[], count: number): string[]` : `E<n>` à partir du plus grand numéro existant + 1.
  - `validateSessionInput(raw: { title: string; level: string; mode: string; wordsText: string; pupilIds: string[]; options: SessionOptions }): { ok: true; value: SessionInput; duplicates: string[] } | { ok: false; errors: Record<'title' | 'level' | 'words' | 'pupils', string> }` (messages en français, entre autres « Ajoute au moins un mot. », « Choisis au moins un élève. » ; maximum 40 mots **[choix du plan, à valider]**).

- [ ] **Step 1: Write the failing tests**
  - `nextPupilCodes(['E1','E3'],2)` → `['E4','E5']` ; `nextPupilCodes([],3)` → `['E1','E2','E3']`.
  - `generateAccessCode(() => 0)` vaut `'AAAAAA'` ; 1000 appels avec le tirage réel : longueur 6 et aucun caractère parmi `O0I1`.
  - `validateSessionInput` : titre vide → `errors.title` ; 0 mot → `errors.words` ; 41 mots → `errors.words` ; mots `'paire\npaire'` → `ok:true` avec `value.words ['paire']` et `duplicates ['paire']` ; 0 élève → `errors.pupils` ; niveau `'P7'` → `errors.level`.
- [ ] **Step 2:** Run `npm test` : FAIL. Implémenter. Run : PASS.
- [ ] **Step 3:** Commit `feat: codes d'accès, codes élèves, validation du formulaire`.

---

### Task 7: Écrans de l'élève

**Files:**
- Create: `src/pages/PupilEntry.tsx`, `src/pages/PupilExercise.tsx`, `src/components/LetterBoard.tsx`
- Modify: `src/App.tsx` (routes `/eleve` et `/eleve/jeu?session=CODE&eleve=E1`)

**Interfaces:**
- Consumes: `openSession`, `recordAttempt`, `recordHelp` (Task 5) ; `createExercise`, `exerciseReducer`, `nextTask`, `createSaveQueue` (Task 4) ; `speechService` (existant, voix du navigateur) ; `shuffleArray`.
- Produces: `LetterBoard({ state, onPlace(poolIndex), onUnplace(slot), onValidate(), onRetry(), disabled })` : cases du mot et lettres du pool, boutons ≥ 48 px, lettres en rouge sur `wrongIdx` avant réinitialisation (logique de Dictée Interactive, 2 s puis `retry` automatique).

Comportement exigé :
- `PupilEntry` : deux champs (code de la dictée, code élève), chacun avec label, exemple (`K7M2QX`, `E1`) et aide ; envoie vers `/eleve/jeu?session=…&eleve=…`. Aucun prénom demandé.
- `PupilExercise` : ouvre la session (`openSession`), mélange les items une fois, enchaîne avec `nextTask` ; consigne à l'infinitif ; bouton « Écouter » (compte les écoutes du mot, remis à 0 à chaque enregistrement) ; à chaque `validate`, enregistre via la file (`recordAttempt`, capture JPEG `html2canvas` échelle 1, qualité 0,6, seulement si faux) ; bouton « Montrer la bonne orthographe » seulement si `options.showCorrect` et étape A : affiche le mot, appelle `recordHelp`, l'élève doit ensuite le placer ; étape C : pas de bouton d'aide ; fin : message de fin sans note ni score.
- Bandeau « Enregistrement en attente » tant que `pending() > 0` (via `onChange`) ; `beforeunload` demande confirmation si `pending() > 0`.
- Code inconnu : « Code inconnu. Vérifier les deux codes avec ton enseignante. », rien d'autre.

- [ ] **Step 1:** Écrire les trois fichiers et les routes selon le bloc ci-dessus ; mélange des items une fois par chargement.
- [ ] **Step 2:** Run `npx vite build` et `npm test` : PASS.
- [ ] **Step 3:** Vérification manuelle après Task 2 appliquée (voir Task 10, recette) ; ne rien affirmer « vérifié » avant.
- [ ] **Step 4:** Commit `feat: écrans élève (entrée, exercice en lettres, étape C)`.

---

### Task 8: Écrans de l'enseignante

**Files:**
- Create: `src/pages/TeacherDashboard.tsx`, `src/pages/PupilsPage.tsx`, `src/pages/NewSession.tsx`, `src/pages/SessionResults.tsx`
- Modify: `src/App.tsx` (routes protégées `/enseignant`, `/enseignant/eleves`, `/enseignant/session/nouvelle`, `/enseignant/resultats/:sessionId`)

**Interfaces:**
- Consumes: `listSessions`, `listPupils`, `createPupils`, `createSession`, `getResults`, `saveComment` (Task 5) ; `nextPupilCodes`, `validateSessionInput` (Task 6) ; `summarizeItem`, `summarizeSession` (Task 4).

Comportement exigé (voir `maquettes/ecran-enseignant-v2.html`) :
- `PupilsPage` : liste des codes ; bouton « Ajouter N codes » (champ avec label, exemple `5`, aide : « Les codes sont anonymes. Garde chez toi la correspondance avec les prénoms. »).
- `NewSession` : 3 étapes visibles (mots, type, publier) ; étape 3 réduite ici à un récapitulatif (les phrases IA arrivent au plan 2) ; options repliées avec valeurs par défaut selon le type (en classe : `showCorrect` désactivé ; autonomie : activé) ; avertissement non bloquant pour les doublons ; après création : page avec le code de la dictée, un lien et un QR (`qrcode`) par élève `…/eleve/jeu?session=CODE&eleve=E1`.
- `TeacherDashboard` : liste des dictées (titre, niveau, type, nombre de mots et d'élèves, lien vers les résultats) et boutons vers `NewSession` et `PupilsPage`.
- `SessionResults` : sélecteur d'élève (vue de classe = une ligne par élève avec « n sur N du premier coup » et « n à revoir ») ; pour un élève : bandeau (2 chiffres), une ligne par mot avec pastille, mot et étiquette de `summarizeItem`, détail dépliable (écrit au 1er essai, essais, écoutes, capture) ; champ de commentaire avec interrupteur « Privé / Visible par les personnes autorisées » (défaut privé) et phrase d'aide « C'est toi qui interprètes ces résultats. L'application ne donne ni note ni conclusion sur l'élève. » ; état vide explicite (« Aucune réponse enregistrée pour cet élève. »). Pas de durée de séance, pas de temps par mot.

- [ ] **Step 1:** Écrire les quatre pages et les routes.
- [ ] **Step 2:** Run `npx vite build` et `npm test` : PASS.
- [ ] **Step 3:** Commit `feat: écrans enseignante (élèves, création, résultats)`.

---

### Task 9: Branding PLAI et accessibilité

**Files:**
- Create: `src/plai-style.css` (copie de `shared/css/plai-style.css` du workspace), `public/plai-logo.jpg` (copie de `projets/portail-plai/public/plai-logo.jpg`)
- Modify: `index.html` (polices DM Serif Display et DM Sans), `src/main.tsx`, `src/pages/*`, `src/components/LetterBoard.tsx`

- [ ] **Step 1:** Importer le CSS, ajouter nav (logo 32 px de haut, largeur auto), conteneur et pied de page (logo 40 px) sur toutes les pages ; vérifier avec une capture que le logo n'est pas déformé (ratio ~2,56:1).
- [ ] **Step 2:** Contrôler : police ≥ 16 px partout, contraste du texte, boutons ≥ 48 px, focus visible, tout champ avec label, placeholder et aide ; corriger.
- [ ] **Step 3:** Run `npx vite build`. Commit `style: branding PLAI et accessibilité de base`.

---

### Task 10: Recette locale et mise en ligne

**Files:**
- Create: `docs/recette-plan-1.md`

- [ ] **Step 1:** Écrire `docs/recette-plan-1.md` : chemins Windows absolus et URL exactes, scénario complet (créer 2 codes élèves, une dictée de 4 mots dont « peut-être » et « aujourd’hui », passer l'élève E1 avec une faute, une aide, puis le tour C ; vérifier chaque ligne de résultats ; recharger au milieu ; couper le réseau au milieu ; saisir un mauvais code).
- [ ] **Step 2:** Lancer `npm run dev` avec `.env.local` du projet cible (JF fournit les deux variables) ; dérouler la recette dans le navigateur intégré, en notant pour chaque point : constaté / déduit / non vérifié. Le test `file://` ne s'applique pas : c'est une application React servie par un serveur.
- [ ] **Step 3:** JF crée le dépôt GitHub vide `jfb4plai/DicteeAccessible` ; `git remote add origin …` ; `npx vite build` puis `git push -u origin main` (identifiants GCM en cache).
- [ ] **Step 4:** JF relie le dépôt à un projet Vercel et saisit `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` ; vérifier l'URL publique avec le même scénario (au moins : connexion enseignante, créer, passer, lire les résultats).
- [ ] **Step 5:** Mettre à jour la mémoire du projet (état, URL, ce qui est testé et par qui) ; demander à JF une recette sur tablette avant tout usage avec l'élève.
