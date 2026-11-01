# DictéeAccessible, plan 3 : voix belge (ElevenLabs), nombres et lexique belges

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'élève entend les mots et les phrases par une voix belge (Adrien ou « jef »), avec « nonante », « septante » et « ouagon » prononcés comme en classe, sans exposer la clé ElevenLabs et sans régénérer l'audio à chaque écoute.

**Architecture:** Une fonction Vercel `GET /api/speak` reçoit seulement des identifiants (code de la dictée, type, id, empreinte du texte). Elle lit le texte réel et la voix de la dictée par une fonction SQL `security definer`, le convertit en prononciation belge (`toBelgianSpeech`, pure, testée), appelle ElevenLabs, et renvoie l'audio avec un en-tête de cache d'un an : le CDN de Vercel garde la réponse, donc un mot n'est généré qu'une fois par région pour toute la classe. Si l'audio échoue, l'élève entend la voix du navigateur (repli du plan 1). Aucun stockage ni clé supplémentaire dans la base.

**Tech Stack:** celui des plans 1 et 2. Aucune nouvelle dépendance.

**Spec:** `docs/superpowers/specs/2026-11-01-dicteeactif-design.md` §6, §6.1, §6.2, §7.

## Global Constraints

- Branche `main`. `npx vite build`, `npm test` et `npm run typecheck:api` passent avant tout push. Messages de commit terminés par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Tables préfixées `dicta_`, `revoke ... from public` puis `grant` explicites sur toute fonction ajoutée. SQL montré à JF avant application.
- Clé et identifiants de voix : variables Vercel `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ADRIEN`, `ELEVENLABS_VOICE_JEF`. Jamais dans le code, un journal ou une réponse. La clé est dans `C:/Users/jfbeg/.secrets/elevenlabs.env.txt` (hors OneDrive) : la poser sur Vercel exige l'accord explicite de JF.
- Aucun `console.log` de texte de dictée. Imports `.js` depuis `api/*.ts` vers `src/lib`.
- Le texte affiché à l'élève n'est jamais modifié ; seul le texte envoyé à ElevenLabs l'est (`toBelgianSpeech`).
- Voix : Adrien (défaut) ou « jef ». Écartées : Christophe Géradon, Léa, Anaïs, Sand. Option « voix de l'appareil » toujours disponible.
- Modèle ElevenLabs : `eleven_multilingual_v2`, `language_code: "fr"`, sortie `mp3_44100_64`.
- Interface : Arial, 16 px minimum, aucune police à empattements, « enseignant(e) ».

## Décisions que ce plan prend (à valider par JF)

1. **Voix par dictée**, choisie à la création (Adrien par défaut, « jef », ou voix de l'appareil), enregistrée dans `dicta_sessions.voice`. Les dictées déjà créées prennent Adrien.
2. **Cache par le CDN**, pas par une table : l'URL contient le code de la dictée, l'id et l'empreinte du texte ; si l'enseignant(e) modifie la phrase, l'URL change.
3. **Qui peut demander un audio** : toute personne qui connaît le code d'une dictée **publiée** et l'id d'un mot ou d'une phrase de celle-ci. Pas de code élève dans l'URL (sinon le cache ne serait pas partagé). Le texte lu est toujours celui de la base.
4. **Lexique belge de départ** : wagon(s), Wallonie, wallon(s), wallonne(s) (spec §6.2). Tout ajout est validé à l'oreille par JF ou une enseignante belge avant d'entrer dans le fichier.
5. **Quota ElevenLabs inconnu** : la clé n'a pas le droit de lire l'abonnement. Une dictée de 10 mots et 3 phrases coûte environ 200 à 400 caractères par région de cache. À vérifier dans le tableau de bord ElevenLabs avant l'usage réel.

## Review Focus

1. Nombres : 70, 71, 80, 81, 90, 91, 99, 100, 101, 200, 280, 1990, 2024, 21 000, 80 000 ; « 3,5 », « 1er », « A4 », « 1 000 » laissés tels quels (Task 1).
2. Lexique : « Wagons », « wagon-lit », « Wallonie. » (ponctuation), « kiwi » inchangé, majuscule conservée (Task 2).
3. `/api/speak` : méthode, paramètres manquants ou mal formés, dictée non publiée, id d'une autre dictée, empreinte qui ne correspond plus au texte, ElevenLabs indisponible ou quota épuisé : réponse sobre, jamais de détail, jamais d'appel à ElevenLabs sans texte validé en base (Task 4).
4. Repli : si l'audio échoue, l'élève entend quand même le mot ou la phrase (Task 5).
5. Aucune fuite : ni clé, ni identifiant de voix, ni texte de dictée dans une erreur ou un journal (Task 4).

## File Structure

- `src/lib/belgianNumbers.ts`, `belgianLexicon.ts`, `belgianSpeech.ts` : logique pure, testée.
- `api/speak.ts` : fonction Vercel.
- `src/lib/audio.ts` : lecteur côté élève (audio, empreinte, repli).
- `supabase/migrations/20261103120000_dicta_voice.sql`, `supabase/tests/dicta_voice_test.sql`.
- Modifiés : `WordExercise.tsx`, `SentenceExercise.tsx`, `PupilExercise.tsx`, `NewSession.tsx`, `sessionForm.ts`, `api.ts`, `apiMapping.ts`, `types.ts`.

---

### Task 1: Nombres en lettres, français de Belgique (logique pure)

**Files:** Create `src/lib/belgianNumbers.ts` ; Test `src/lib/__tests__/belgianNumbers.test.ts`.

**Interfaces:** Produces `numbersToBelgianWords(text: string): string` : remplace chaque entier de 0 à 999 999 isolé dans le texte (motif `(?<![\p{L}\p{N}.,])\d{1,6}(?![\p{L}\p{N}]|[.,]\d)`) par ses mots ; laisse tels quels les nombres collés à des lettres (« A4 », « 1er »), les décimaux (« 3,5 », « 3.5 »), les groupes à espaces (« 1 000 »), les nombres à zéro initial (« 007 ») et ceux au-dessus de 999 999.

Règles : 0 à 16 par mots simples ; 17 à 19 « dix-sept » à « dix-neuf » ; 20, 30, 40, 50, 60 « vingt » à « soixante » ; 70 « septante », 80 « quatre-vingts », 90 « nonante » ; « et un » pour 21, 31, 41, 51, 61, 71, 91 ; 81 « quatre-vingt-un » ; traits d'union entre dizaines et unités ; « quatre-vingts » et « cents » prennent leur « s » seulement s'ils terminent le nombre ; « cent » seul pour 100 ; « mille » invariable, « un mille » jamais.

- [ ] **Step 1: Write the failing tests** (assertions exactes) : 0 « zéro », 7 « sept », 16 « seize », 17 « dix-sept », 21 « vingt et un », 70 « septante », 71 « septante et un », 72 « septante-deux », 79 « septante-neuf », 80 « quatre-vingts », 81 « quatre-vingt-un », 90 « nonante », 91 « nonante et un », 99 « nonante-neuf », 100 « cent », 101 « cent un », 170 « cent septante », 180 « cent quatre-vingts », 190 « cent nonante », 200 « deux cents », 201 « deux cent un », 280 « deux cent quatre-vingts », 1000 « mille », 1990 « mille neuf cent nonante », 2024 « deux mille vingt-quatre », 21000 « vingt et un mille », 80000 « quatre-vingt mille », 200000 « deux cent mille », 999999 « neuf cent nonante-neuf mille neuf cent nonante-neuf ». Phrases : « Il a 90 ans. » → « Il a nonante ans. » ; « 70 et 90 » → « septante et nonante » ; inchangés : « 3,5 », « 3.5 », « 1er », « A4 », « 1 000 », « 007 », « 1000000 ». Texte sans chiffre inchangé, chaîne vide.
- [ ] **Step 2:** Run `npm test -- belgianNumbers` : FAIL. **Step 3:** Implémenter (fonctions internes `below100(n, final)`, `below1000(n, final)`, `thousands(n)`). **Step 4:** Run `npm test` : PASS. Commit `feat: nombres en lettres, français de Belgique`.

---

### Task 2: Lexique belge et `toBelgianSpeech` (logique pure)

**Files:** Create `src/lib/belgianLexicon.ts`, `src/lib/belgianSpeech.ts` ; Test `src/lib/__tests__/belgianSpeech.test.ts`.

**Interfaces:** Produces `LEXICON: Record<string, string>` (clés en minuscules, fichier de données) = wagon → ouagon, wagons → ouagons, wallonie → ouallonie, wallon → ouallon, wallons → ouallons, wallonne → ouallonne, wallonnes → ouallonnes. Produces `applyLexicon(text: string, lexicon?: Record<string, string>): string` : mots entiers (le mot peut être suivi d'un trait d'union : « wagon-lit »), insensible à la casse, majuscule initiale conservée. Produces `toBelgianSpeech(text: string): string` = `applyLexicon(numbersToBelgianWords(text))`.

- [ ] **Step 1: Write the failing tests** : « Un wagon. » → « Un ouagon. » ; « Wagons » → « Ouagons » ; « La Wallonie. » → « La Ouallonie. » ; « Un wallon, une wallonne. » → « Un ouallon, une ouallonne. » ; « wagon-lit » → « ouagon-lit » ; « kiwi » et « swagger » inchangés ; « Il a 90 ans, un wagon. » → « Il a nonante ans, un ouagon. » ; texte vide.
- [ ] **Step 2:** Run : FAIL. **Step 3:** Implémenter. **Step 4:** Run `npm test` : PASS. Commit `feat: lexique belge et toBelgianSpeech`.

---

### Task 3: Voix de la dictée en base (SQL)

**Files:** Create `supabase/migrations/20261103120000_dicta_voice.sql`, `supabase/tests/dicta_voice_test.sql`.

**Interfaces:** Produces :
- `dicta_sessions.voice text not null default 'adrien' check (voice in ('adrien','jef','device'))`.
- `dicta_open_session` remplacée : ajoute `'voice', sess.voice` ; le reste inchangé.
- `dicta_audio_text(p_access_code text, p_kind text, p_id uuid) returns jsonb` `{text, voice}` : `security definer`, `search_path = public` ; code insensible à la casse et aux espaces ; dictée **publiée** seulement ; `p_kind = 'word'` lit `dicta_items.word`, `'sentence'` lit `dicta_sentences.text` avec `validated`, dans la même dictée ; sinon lève `invalid_access` ; `revoke all from public`, `grant execute to anon, authenticated`.

- [ ] **Step 1: Write the failing test** `dicta_voice_test.sql` (`begin; ... rollback;`) : mot et phrase d'une dictée publiée renvoient texte et voix ; voix par défaut `adrien` ; `p_kind='sentence'` sur un mot, id d'une autre dictée, phrase non validée, dictée non publiée, code inconnu lèvent tous `invalid_access` ; `dicta_open_session` contient `voice` ; une voix inconnue est refusée par la contrainte ; `anon` ne lit toujours aucune table.
- [ ] **Step 2:** Écrire la migration. **Step 3:** **Montrer le SQL à JF et attendre son accord**, puis appliquer (`npx supabase db query --linked --project-ref otiorljbujqzruulmqrs -f <fichier>`), exécuter le test, vérifier les droits. Commit `feat: voix de la dictée`.

---

### Task 4: Fonction `GET /api/speak`

**Files:** Create `api/speak.ts` ; Test `src/lib/__tests__/speakHandler.test.ts`.

**Interfaces:** Produces `export default async function handler(req, res)` : GET seulement (405). Paramètres `session`, `kind` (`word` ou `sentence`), `id` (UUID), `h` (16 caractères hexadécimaux) : sinon 400. Étapes : `POST {VITE_SUPABASE_URL}/rest/v1/rpc/dicta_audio_text` avec la clé anon ; échec ou `invalid_access` → 404 ; empreinte : SHA-256 hexadécimal du texte, 16 premiers caractères, différente de `h` → 409 ; voix `device` → 404 ; identifiant de voix lu dans `ELEVENLABS_VOICE_ADRIEN` ou `ELEVENLABS_VOICE_JEF` (absent → 500 `config`) ; `toBelgianSpeech(text)` ; appel `POST https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_64` ; succès : 200, `Content-Type: audio/mpeg`, `Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable`, corps binaire ; toute erreur ElevenLabs (quota, réseau) : 502 `{ error: 'audio' }` sans détail. Produces `textHash(text: string): Promise<string>` dans `src/lib/audioHash.ts` (pur, partagé avec le client).

- [ ] **Step 1: Write the failing tests** (`fetch` simulé) : POST → 405 ; paramètres manquants ou `id` non UUID → 400 ; RPC en erreur → 404 et **aucun appel à ElevenLabs** ; empreinte fausse → 409 et aucun appel à ElevenLabs ; voix `device` → 404 ; cas nominal : le corps envoyé à ElevenLabs contient « nonante » quand le texte de la base est « Il a 90 ans. » ; en-têtes `Content-Type` et `Cache-Control` exacts ; échec ElevenLabs → 502 `{ error: 'audio' }` ; la clé n'apparaît dans aucune réponse ; `textHash('Le chat dort.')` fait 16 caractères hexadécimaux et change quand le texte change.
- [ ] **Step 2:** Run : FAIL. **Step 3:** Implémenter `audioHash.ts` puis `api/speak.ts`. **Step 4:** Run `npm test`, `npm run typecheck`, `npm run typecheck:api`, `npx vite build` : PASS. Commit `feat: fonction audio belge`.

---

### Task 5: Lecteur élève et choix de la voix par l'enseignant(e)

**Files:** Create `src/lib/audio.ts` ; Modify `src/lib/types.ts`, `apiMapping.ts`, `api.ts`, `sessionForm.ts`, `src/components/WordExercise.tsx`, `SentenceExercise.tsx`, `src/pages/PupilExercise.tsx`, `NewSession.tsx` ; Test `src/lib/__tests__/audioUrl.test.ts`, `sessionForm.test.ts`, `api.test.ts`.

**Interfaces:**
- Produces (`audio.ts`) : `buildSpeakUrl(a: { accessCode: string; kind: 'word' | 'sentence'; id: string; hash: string }): string` (`/api/speak?session=…&kind=…&id=…&h=…`, codes normalisés) ; `createPlayer(opts: { accessCode: string; voice: 'adrien' | 'jef' | 'device' }): { playWord(item: DictaItem): Promise<void>; playSentence(s: DictaSentence): Promise<void>; stop(): void }` : voix `device` ou échec de l'audio (réponse non 200, lecture refusée, délai de 8 s dépassé) → `speechService.speak(texte)`.
- `OpenedSession.voice: 'adrien' | 'jef' | 'device'` (lu dans `toOpenedSession`, défaut `adrien`) ; `SessionInput.voice` ; `createSession` l'enregistre ; `validateSessionInput` accepte `voice` (défaut `adrien`, valeur inconnue refusée avec `errors.voice`).
- `WordExercise` et `SentenceExercise` reçoivent une prop `speak: () => Promise<void>` et n'appellent plus `speechService` directement (lecture automatique à l'arrivée et bouton « Écouter »).
- `NewSession` : champ « Voix de lecture » (Adrien, voix belge · Jean-François, voix clonée · Voix de l'appareil) avec aide : « Adrien lit « nonante » et « septante » comme en Belgique. La voix de l'appareil ne demande aucun service en ligne mais lit « quatre-vingt-dix » comme en France. »

- [ ] **Step 1: Write the failing tests** : `buildSpeakUrl` normalise le code (`' gh7fcv '` → `GH7FCV`) et encode les paramètres ; `validateSessionInput` : `voice` absent → `adrien`, `'jef'` accepté, `'robot'` refusé ; `toOpenedSession` lit `voice` et retombe sur `adrien` sans le champ.
- [ ] **Step 2:** Run : FAIL. **Step 3:** Implémenter ; brancher les composants ; `npm run typecheck` PASS. **Step 4:** Vérification navigateur contre le faux serveur local : le bouton « Écouter » émet une requête `/api/speak` (réponse 404 simulée) puis la voix de l'appareil prend le relais ; voix `device` : aucune requête `/api/speak`. Noter constaté / non vérifié. Commit `feat: lecteur audio élève et choix de la voix`.

---

### Task 6: Revue, déploiement, recette réelle

- [ ] **Step 1:** Revue indépendante de la branche (SQL compris) ; corrections en une passe, chacune testée avant.
- [ ] **Step 2:** **Avec l'accord de JF**, poser `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ADRIEN`, `ELEVENLABS_VOICE_JEF` sur le projet Vercel `dicteeaccessible` (Production). Appliquer le SQL (après accord), pousser.
- [ ] **Step 3:** Recette réelle avec le compte de JF dans Chrome : créer une dictée avec la voix Adrien, un mot et une phrase contenant « 90 » et « wagon » ; appeler `/api/speak` ; vérifier `audio/mpeg`, les en-têtes de cache, l'appel répété (réponse servie du cache : l'en-tête `x-vercel-cache`), le repli avec une empreinte fausse ; envoyer les audios à JF pour écoute ; nettoyer les données de test.
- [ ] **Step 4:** Mettre à jour la mémoire ; demander à JF le test sur tablette (lecture audio sous iOS : lecture déclenchée par le bouton).
