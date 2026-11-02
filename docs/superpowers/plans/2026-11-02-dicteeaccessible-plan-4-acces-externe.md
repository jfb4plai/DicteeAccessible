# DictéeAccessible plan 4 : accès externe sur invitation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'enseignant(e) crée pour un élève un lien personnel, en lecture seule, qu'elle envoie elle-même à l'ergothérapeute ou à un parent ; elle peut le retirer à tout moment.

**Architecture:** Table `dicta_shares` sans aucun accès direct ; quatre fonctions SQL `security definer` (créer, lister, retirer, consulter). Le jeton (32 octets) n'existe en clair qu'à l'écran de création, la base garde son empreinte SHA-256. La consultation renvoie du JSON déjà borné ; le client réutilise `summarizeItem` / `summarizeSentence` pour afficher les mêmes pastilles que l'écran enseignant. La page publique `/suivi` lit le jeton dans le fragment `#t=…`.

**Tech Stack:** Postgres (Supabase Flashfwb, pgcrypto `digest` / `gen_random_bytes`), React 18 + Vite + TypeScript, Vitest (environnement node, pas de tests de composants).

**Spec:** `docs/superpowers/specs/2026-11-02-acces-externe-design.md`

## Global Constraints

- Toute table, fonction et index porte le préfixe `dicta_`. Aucun accès `anon` aux tables ; `anon` n'a que `execute` sur `dicta_share_view`.
- Grants Data API explicites dans la même migration que le `create table`.
- Jeton : 32 octets aléatoires, 43 caractères base64url (`[A-Za-z0-9_-]`), stocké uniquement sous forme d'empreinte SHA-256 hex.
- URL d'invitation : `<origine>/suivi#t=<jeton>` (fragment, jamais query string).
- Plafond de consultation : 60 par heure et par invitation (erreur `rate_limited`).
- 10 invitations actives au plus par élève (erreur `too_many`).
- Date de fin par défaut : 31 août de l'année scolaire en cours (le 31 août suivant si la date du jour est après le 31 août).
- Libellé d'invitation : 1 à 60 caractères après `btrim`, jamais de prénom d'élève (aide affichée dans le formulaire).
- Réponses invalides : message unique « Cet accès n'est plus valable. Demandez un nouveau lien à l'enseignant(e). » pour jeton inconnu, retiré, expiré ou mal formé.
- Ne jamais renvoyer : captures d'écran, codes de dictée, titre/nom de l'enseignant(e), autres élèves, commentaire dont `visible` est faux.
- Texte d'interface : « enseignant(e) », tutoiement comme dans le reste de l'app, police sans empattements, 16 px minimum, aide sous chaque champ (label précis, placeholder concret, texte d'aide).
- Aucun SQL n'est appliqué à la base partagée sans l'accord explicite de JF. Aucun push sans son accord.
- Aucune expression régulière avec lookbehind dans `src/lib`.

## Review Focus

1. Un jeton valide ne doit jamais ouvrir les données d'un autre élève du même enseignant (ni d'un autre enseignant).
2. Une invitation retirée ou expirée doit cesser de fonctionner immédiatement, avec la même réponse qu'un jeton inconnu.
3. Un élève sans aucun résultat doit donner une page claire (« Aucun résultat enregistré pour l'instant »), pas une page vide ni une erreur.
4. `/suivi` sans fragment, avec un fragment tronqué ou mal formé : message neutre, aucun appel réseau pour un jeton qui ne respecte pas le format.
5. Le commentaire n'apparaît que si `visible` est vrai et le texte non vide ; la valeur par défaut reste privée.
6. L'élève ayant beaucoup de tentatives (plusieurs centaines) : la réponse reste bornée (50 dictées les plus récentes).

---

### Task 1: Migration SQL et test SQL

**Files:**
- Create: `supabase/migrations/20261104120000_dicta_shares.sql`
- Create: `supabase/tests/dicta_shares_test.sql`

**Interfaces:**
- Produces (SQL, tous `security definer`, `set search_path = public, extensions`) :
  - `dicta_share_create(p_pupil_id uuid, p_label text, p_expires_at timestamptz) returns jsonb` → `{ "id": uuid, "token": text }` ; erreurs : `not_owner`, `invalid_label`, `invalid_expiry` (passée ou plus de 2 ans), `too_many`.
  - `dicta_share_list(p_pupil_id uuid) returns jsonb` → tableau trié du plus récent au plus ancien d'objets `{ id, label, expires_at, revoked_at, last_used_at, created_at }` ; erreur `not_owner`.
  - `dicta_share_revoke(p_share_id uuid) returns void` ; erreur `not_owner` ; idempotent.
  - `dicta_share_view(p_token text) returns jsonb` → `{ "pupil_code": text, "sessions": [ { id, title, level, mode, created_at, final_round, items:[{id,word,position}], sentences:[{id,position,text,parasites,item_id}], attempts:[{item_id,sentence_id,stage,kind,attempt_number,answer,correct,listens}], comment: text|null } ] }` ; erreurs : `invalid_share`, `rate_limited`.
- Table `dicta_shares(id, user_id, pupil_id → dicta_pupils on delete cascade, label, token_hash unique, expires_at, revoked_at, last_used_at, window_start, window_count, created_at)`, RLS activée, aucune politique, `revoke all` pour `anon` et `authenticated`, `all` pour `service_role`.

- [ ] **Step 1: Write the failing SQL test** `supabase/tests/dicta_shares_test.sql`, dans le style de `dicta_voice_test.sql` (transaction annulée à la fin, utilisateurs et lignes de test avec UUID fixes, exceptions sur assertion fausse). Utiliser deux enseignants (A, B), deux élèves de A (E1, E2), un élève de B, une dictée publiée de A avec E1 et E2 (un mot, une phrase validée, une phrase non validée, tentatives dont une avec `screenshot`), une dictée non publiée de A avec E1, un commentaire visible pour E1 et un commentaire privé pour E2. Simuler `auth.uid()` comme dans `dicta_rpc_test.sql` (lire ce fichier d'abord pour reprendre la méthode). Assertions :
  1. A crée une invitation pour E1 : le jeton fait 43 caractères `[A-Za-z0-9_-]`, `dicta_shares.token_hash` ne contient pas le jeton et fait 64 caractères hex.
  2. `dicta_share_view(jeton)` renvoie `pupil_code = 'E1'`, uniquement des dictées publiées, aucune tentative d'E2, aucune clé `screenshot`, aucune clé `access_code`, le commentaire visible d'E1.
  3. Jeton de l'invitation d'E2 : le commentaire privé n'apparaît pas (`comment` nul) et aucune donnée d'E1.
  4. B ne peut ni créer (`not_owner`), ni lister (`not_owner`), ni retirer (`not_owner`) pour un élève ou une invitation de A.
  5. Libellé vide, de 61 caractères ou de espaces : `invalid_label` ; date passée ou à plus de 2 ans : `invalid_expiry`.
  6. Après `dicta_share_revoke`, `view` lève `invalid_share` ; second `revoke` sans erreur.
  7. Invitation expirée (mettre `expires_at` dans le passé par `update` en tant que propriétaire de la base de test) : `invalid_share`.
  8. Jeton inconnu, vide, `null`, de 43 caractères quelconques : `invalid_share`.
  9. 60 consultations passent, la 61e lève `rate_limited` ; après avoir reculé `window_start` de 2 heures, la consultation repasse.
  10. 11e invitation active pour le même élève : `too_many` ; après un retrait, la création repasse.
  11. `dicta_share_list` ne contient ni `token_hash` ni jeton.
  12. `anon` ne peut exécuter que `dicta_share_view` (`has_function_privilege`) ; `anon` et `authenticated` n'ont aucun privilège de table sur `dicta_shares` (`has_table_privilege`).
  13. Supprimer l'élève supprime ses invitations (cascade).

- [ ] **Step 2: Write the migration** `supabase/migrations/20261104120000_dicta_shares.sql` : en-tête de commentaire dans le style des migrations existantes (rappel : projet partagé, préfixe `dicta_`, lecture uniquement par fonctions), table, `enable row level security`, `revoke all`, grants `service_role`, les quatre fonctions, `revoke all on function … from public`, `grant execute` : create/list/revoke à `authenticated`, view à `anon, authenticated`. Jeton : `translate(replace(encode(gen_random_bytes(32), 'base64'), E'\n', ''), '+/=', '-_')` (retirer le `=` final), empreinte `encode(digest(jeton, 'sha256'), 'hex')`. Dans `view` : refuser tout jeton qui ne respecte pas `^[A-Za-z0-9_-]{43}$` avec `invalid_share` ; fenêtre glissante par invitation (`window_start`, `window_count`, remise à zéro après 1 heure) ; mettre à jour `last_used_at` ; dictées triées par `created_at desc`, 50 au plus, seulement `published` et ayant au moins une ligne `dicta_attempts` de l'élève ; phrases seulement `validated` ; commentaire seulement si `visible and btrim(body) <> ''`.

- [ ] **Step 3: Run the test on a local copy only if one exists; otherwise stop here.** La base Flashfwb est partagée : ne pas appliquer la migration ni exécuter le test sans l'accord explicite de JF. Montrer à JF le fichier de migration et demander l'accord.

- [ ] **Step 4: After JF's explicit OK, apply and test**

Run: `npx supabase db query --linked --project-ref otiorljbujqzruulmqrs -f supabase/migrations/20261104120000_dicta_shares.sql` puis `… -f supabase/tests/dicta_shares_test.sql`
Expected: aucune erreur ; le test se termine par un `rollback`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261104120000_dicta_shares.sql supabase/tests/dicta_shares_test.sql
git commit -m "feat: invitations en lecture seule (dicta_shares, fonctions create/list/revoke/view)"
```

---

### Task 2: Logique pure côté client (liens, expiration, vue partagée)

**Files:**
- Create: `src/lib/shareLink.ts`, `src/lib/sharedView.ts`
- Test: `src/lib/__tests__/shareLink.test.ts`, `src/lib/__tests__/sharedView.test.ts`

**Interfaces:**
- Consumes: `summarizeItem(item, rows, finalRound): ItemSummary`, `summarizeSentence(s, rows, mode): SentenceSummary` (`src/lib/progress.ts`) ; `toAttemptRow(raw): AttemptRow` (`src/lib/apiMapping.ts`) ; types `DictaItem`, `DictaSentence`, `AttemptRow` (`src/lib/types.ts`).
- Produces:
  - `shareLink.ts` : `TOKEN_PATTERN: RegExp` (`^[A-Za-z0-9_-]{43}$`) ; `buildShareUrl(origin: string, token: string): string` ; `parseShareToken(hash: string): string | null` ; `defaultShareExpiry(now: Date): Date` ; `buildInviteMailto(url: string, label: string): string`.
  - `sharedView.ts` : `type SharedSession = { id: string; title: string; level: string; mode: 'autonomy' | 'class'; createdAt: string; finalRound: boolean; items: DictaItem[]; sentences: DictaSentence[]; attempts: AttemptRow[]; comment: string | null }` ; `type SharedView = { pupilCode: string; sessions: SharedSession[] }` ; `toSharedView(raw: unknown): SharedView` ; `wordsToReview(view: SharedView): { word: string; sessionId: string; sessionTitle: string }[]` (mots de statut `red`, un mot répété dans plusieurs dictées apparaît une fois par dictée, ordre des dictées puis des mots) ; `shareErrorMessage(code: string): string`.

- [ ] **Step 1: Write failing tests** `shareLink.test.ts` : `buildShareUrl('https://x.app', T)` donne `https://x.app/suivi#t=T` ; `parseShareToken('#t=' + T)` rend `T`, et `null` pour `''`, `'#t='`, `'#t=court'`, un jeton de 44 caractères, un jeton avec `+`, `'#autre=…'` ; `defaultShareExpiry` : le 2 novembre 2026 → 31 août 2027, le 15 mars 2027 → 31 août 2027, le 31 août 2027 → 31 août 2027, le 1er septembre 2027 → 31 août 2028 (comparer `getFullYear/getMonth/getDate` et fin de journée `23:59:59`) ; `buildInviteMailto` commence par `mailto:?subject=`, contient le lien encodé (`encodeURIComponent`), contient le libellé, ne contient pas « E1 » quand le libellé n'en contient pas, mentionne « lecture seule » et « ne le transmettez pas ». `sharedView.test.ts` : `toSharedView` convertit un JSON de `dicta_share_view` (snake_case) en camelCase, laisse `comment` à `null` si absent, `parasites` à `[]` si absent ; `wordsToReview` retourne les mots `red` d'une vue de deux dictées (construire des tentatives à la main : mot A raté 3 fois puis dernier tour raté, mot B réussi du premier coup) ; `shareErrorMessage('invalid_share')` = le message unique des contraintes globales, `shareErrorMessage('rate_limited')` contient « Trop de consultations », tout autre code donne « Consultation impossible. Réessayer. ».

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/__tests__/shareLink.test.ts src/lib/__tests__/sharedView.test.ts`
Expected: FAIL (modules absents).

- [ ] **Step 3: Implement `shareLink.ts` and `sharedView.ts`** avec les signatures ci-dessus, sans lookbehind ; `toSharedView` s'appuie sur `toAttemptRow` pour les tentatives ; `wordsToReview` s'appuie sur `summarizeItem`.

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run`
Expected: tous les tests passent (391 existants + les nouveaux).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shareLink.ts src/lib/sharedView.ts src/lib/__tests__/shareLink.test.ts src/lib/__tests__/sharedView.test.ts
git commit -m "feat: liens d'invitation, expiration par défaut et vue partagée (logique pure)"
```

---

### Task 3: Fonctions d'accès (api.ts)

**Files:**
- Modify: `src/lib/api.ts` (nouvelle section « Invitations »)
- Test: `src/lib/__tests__/shareApi.test.ts`

**Interfaces:**
- Consumes: `supabase.rpc` (client existant), `toSharedView`, `shareErrorMessage` (Task 2).
- Produces: `type ShareInfo = { id: string; label: string; expiresAt: string; revokedAt: string | null; lastUsedAt: string | null; createdAt: string }` (dans `types.ts`) ; `createShare(pupilId: string, label: string, expiresAt: Date): Promise<{ id: string; token: string }>` ; `listShares(pupilId: string): Promise<ShareInfo[]>` ; `revokeShare(shareId: string): Promise<void>` ; `viewShare(token: string): Promise<SharedView>` (aucune requête si le jeton ne respecte pas `TOKEN_PATTERN` : lève directement le message `invalid_share`).

- [ ] **Step 1: Write failing tests** `shareApi.test.ts` avec un `supabase` simulé par `vi.mock('../supabase', …)` : `viewShare('court')` lève le message unique sans appeler `rpc` ; `viewShare(T)` appelle `dicta_share_view` avec `{ p_token: T }` et renvoie une `SharedView` ; une erreur contenant `rate_limited` donne « Trop de consultations » ; une erreur contenant `invalid_share` donne le message unique ; `createShare` appelle `dicta_share_create` avec `p_expires_at` en ISO et renvoie `{ id, token }` ; une erreur `too_many` donne « 10 invitations actives au plus pour cet élève. Retire-en une d'abord. » ; `listShares` convertit en camelCase.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/__tests__/shareApi.test.ts`
Expected: FAIL (fonctions absentes).

- [ ] **Step 3: Implement** les quatre fonctions dans `api.ts` (même style que `openSession` : `fail(message)` avec un message en français, jamais le texte brut de l'erreur Postgres) et le type `ShareInfo`.

- [ ] **Step 4: Run the whole suite and the type check**

Run: `npx vitest run` puis `npx tsc --noEmit -p tsconfig.json`
Expected: tout passe, aucune erreur de types.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/lib/types.ts src/lib/__tests__/shareApi.test.ts
git commit -m "feat: accès client aux invitations (create/list/revoke/view)"
```

---

### Task 4: Écran enseignant « Inviter quelqu'un à suivre E1 »

**Files:**
- Create: `src/components/ShareInvites.tsx`
- Modify: `src/pages/PupilsPage.tsx` (afficher le composant sous la liste des codes quand il existe au moins un élève)
- Modify: `src/pages/SessionResults.tsx` (le texte d'aide de la case « Visible par les personnes autorisées » ne dit plus « quand l'accès externe sera disponible » mais « Les personnes que tu invites depuis la page Mes élèves pourront le lire »)

**Interfaces:**
- Consumes: `createShare`, `listShares`, `revokeShare`, `ShareInfo` (Task 3) ; `buildShareUrl`, `buildInviteMailto`, `defaultShareExpiry` (Task 2) ; `Pupil` ; classes `plai-card`, `plai-field`, `plai-label`, `plai-input`, `plai-btn`, `plai-btn-ghost`, `help`, `plai-error`.
- Produces: `ShareInvites({ pupils }: { pupils: Pupil[] })`.

- [ ] **Step 1: Implement `ShareInvites`** : une carte « Inviter une personne à suivre un élève » avec (1) menu de l'élève (codes), (2) champ « Nom d'usage de la personne invitée » (placeholder « Exemple : Ergo, Mme Dupont », aide : sert uniquement à t'y retrouver, ne jamais mettre un prénom d'élève), (3) champ date « Fin de l'accès » prérempli par `defaultShareExpiry(new Date())`, aide : après cette date le lien cesse de fonctionner, le retrait reste possible à tout moment, (4) bouton « Créer le lien ». Après création : panneau unique affichant le lien, bouton « Copier le lien » (`navigator.clipboard.writeText`, repli sur sélection du champ si indisponible), lien « Écrire un e-mail » (`buildInviteMailto`), et l'avertissement « Ce lien ne sera plus affiché. Qui le possède voit les résultats de cet élève. L'application n'envoie rien : c'est toi qui le transmets. » Le panneau disparaît quand on change d'élève ou qu'on ferme. Sous le formulaire, liste des invitations de l'élève choisi (`listShares`) : nom d'usage, état (« active jusqu'au … », « expirée », « retirée »), dernière consultation, bouton « Retirer l'accès » avec confirmation courte (retrait immédiat, la liste se met à jour). Textes d'erreur affichés via `plai-error`.

- [ ] **Step 2: Wire into `PupilsPage.tsx` and update the help text in `SessionResults.tsx`.**

- [ ] **Step 3: Type check, suite and build**

Run: `npx tsc --noEmit -p tsconfig.json`, `npx vitest run`, `npx vite build`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/components/ShareInvites.tsx src/pages/PupilsPage.tsx src/pages/SessionResults.tsx
git commit -m "feat: écran d'invitation (créer, copier, écrire un e-mail, retirer)"
```

---

### Task 5: Page publique `/suivi`

**Files:**
- Create: `src/pages/SharedView.tsx`
- Modify: `src/App.tsx` (route publique `/suivi`, hors `ProtectedRoute`)
- Modify: `vercel.json` si présent (en-têtes pour `/suivi` : `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`) ; s'il n'existe pas, créer l'entrée minimale sans toucher aux autres réglages du projet.

**Interfaces:**
- Consumes: `parseShareToken`, `viewShare`, `wordsToReview`, `SharedView` (Tasks 2-3) ; `summarizeItem`, `summarizeSentence`, `summarizeSession` ; classes `dot dot-green|orange|red|grey` de l'écran enseignant.
- Produces: composant `SharedView` (export par défaut).

- [ ] **Step 1: Implement `SharedView.tsx`** : au montage, `parseShareToken(window.location.hash)` ; si `null`, afficher le message unique sans appel réseau ; sinon `viewShare`. Insérer `<meta name="robots" content="noindex">` et `<meta name="referrer" content="no-referrer">` dans `document.head` (retirés au démontage). Mise en page : pas de navigation enseignant ; en-tête avec le code de l'élève, bandeau « Lecture seule. Les résultats sont une information, pas une note. » ; bloc « À revoir » (`wordsToReview`, ou « Rien à revoir pour l'instant. ») ; une carte par dictée (titre, niveau, date, « n sur N réussis du premier coup · m à revoir ») dépliable comme `SessionResults` (pastille, mot, libellé ; détail : écrit au premier essai, essais, écoutes ; phrases) sans aucune image ; commentaire de l'enseignant(e) s'il existe, introduit par « Commentaire de l'enseignant(e) ». Élève sans résultat : « Aucun résultat enregistré pour l'instant. » Erreur : message de `shareErrorMessage`. Taille de police ≥ 16 px, pas de mur de texte.

- [ ] **Step 2: Add the route and headers.**

- [ ] **Step 3: Type check, suite and build**

Run: `npx tsc --noEmit -p tsconfig.json`, `npx vitest run`, `npx vite build`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/pages/SharedView.tsx src/App.tsx vercel.json
git commit -m "feat: page publique de consultation /suivi (lecture seule)"
```

---

### Task 6: Recette et mémoire

**Files:**
- Create: `docs/recette-plan-4.md`
- Modify: `C:\Users\jfbeg\.claude\projects\C--Users-jfbeg-OneDrive-claude-workspace\memory\dicteeactif-session-prompt.md`

- [ ] **Step 1: Write `docs/recette-plan-4.md`** : chemins Windows complets et URL exactes (`https://dicteeaccessible.vercel.app/enseignant/eleves`, `/suivi#t=…`), parcours de recette en 10 étapes numérotées (créer l'invitation, copier, ouvrir le lien dans une fenêtre privée, vérifier ce qui est visible et invisible, retirer, rouvrir et lire le message, expirer, tester sur tablette), colonne « constaté / à vérifier ».
- [ ] **Step 2: Update the memory file** : plan 4 codé, ce qui est appliqué ou non en base, ce qui reste (recette, tablette, consentement parental géré par la référente PLAI).
- [ ] **Step 3: Commit**

```bash
git add docs/recette-plan-4.md
git commit -m "docs: recette du plan 4 (accès externe)"
```
