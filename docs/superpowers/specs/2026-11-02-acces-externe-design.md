# DictéeAccessible : accès externe sur invitation (design)

Date : 2026-11-02. Remplace le §8.3 de `2026-11-01-dicteeactif-design.md`.
Marques : **[JF]** décidé par Jean-François ; **[Mon choix]** décidé par Claude, à relire.

## 1. Intention

Une élève de P3 à écriture lente est suivie par une ergothérapeute. L'ergo adapte sa rééducation à ce que l'élève réussit ou rate en dictée, et l'équipe veut « ramer dans le même sens que les intervenants extérieurs ». **[JF]**

L'enseignant(e) invite une personne extérieure à consulter les résultats d'un élève. La personne consulte, elle ne modifie rien. **[JF]**

## 2. Objectifs, non-objectifs, contre-objectifs

Objectifs
- L'ergo ouvre un lien et voit, pour l'élève invité, ce qui oriente la rééducation : mots et lettres qui posent problème, mots repris ou aidés, évolution d'une dictée à l'autre. **[JF]** pour l'usage, **[Mon choix]** pour la liste exacte (§5).
- L'enseignant(e) crée, voit et retire une invitation en moins d'une minute, sans quitter l'app.

Non-objectifs
- Pas de compte ni de mot de passe pour l'invité. **[JF]** (option A)
- Pas d'envoi automatique d'e-mail par l'app. **[JF]** (option A) L'enseignant(e) envoie elle-même le lien.
- Aucune adresse e-mail de tiers n'est stockée. **[JF]** (option A)
- Pas d'écriture : l'invité ne crée, ne modifie et ne supprime rien. **[JF]**
- Pas de vue « classe » : une invitation couvre un seul élève. **[JF]** (« par élève »)

Contre-objectifs (échec même si ça marche)
- Un lien qui laisse voir un autre élève que celui invité.
- Un lien qui continue de fonctionner après retrait ou expiration.
- Une donnée permettant d'identifier l'élève (nom, photo) visible par l'invité.

## 3. Ce que l'invité voit **[Mon choix]**

Les parents voient la même chose que l'ergo. **[Mon choix]**

Par dictée où l'élève a des résultats :
- titre, niveau, date ;
- une ligne par mot ou phrase : réussi seul / repris ou aidé / non maîtrisé à la fin (mêmes pastilles que l'écran enseignant) ;
- au détail : réponse écrite au premier essai, nombre d'essais, écoutes ;
- le commentaire de l'enseignant(e), seulement s'il est marqué visible (`dicta_comments.visible`, déjà existant, privé par défaut).

Une vue « à revoir » regroupe, toutes dictées confondues, les mots non maîtrisés, pour l'ergo.

Non montré : captures d'écran des tentatives (peuvent contenir autre chose que le mot), durées, nom de l'enseignant(e), autres élèves, codes de dictée.

L'élève n'apparaît que sous son code anonyme (E1). Le rapprochement avec le dossier de l'ergo se fait de son côté. **[Mon choix]**

## 4. Parcours

Enseignant(e)
1. Page « Élèves » : bouton « Inviter quelqu'un à suivre E1 ».
2. Formulaire : nom d'usage de l'invité (ex. « Ergo, Mme X », jamais un prénom d'élève), fin de l'accès (par défaut 31 août de l'année scolaire en cours **[Mon choix]**, modifiable).
3. L'app crée le lien et l'affiche **une seule fois** : bouton « Copier le lien » et bouton « Écrire un e-mail » (mailto prérempli, texte court d'explication, sans nom d'élève).
4. Liste des invitations de l'élève : nom d'usage, date de fin, dernière consultation, bouton « Retirer l'accès » (immédiat).

Invité
1. Ouvre le lien. Page `/suivi` (lecture seule), sans connexion.
2. Voit l'élève sous son code, le bandeau « Lecture seule. Les résultats sont une information, pas une note » et la liste des dictées.
3. Lien retiré ou expiré : message clair (« Cet accès n'est plus valable. Demandez un nouveau lien à l'enseignant(e). ») sans révéler s'il a existé.

## 5. Sécurité

- Le lien contient un jeton aléatoire de 32 octets (43 caractères base64url) placé dans le **fragment** (`/suivi#t=…`), jamais dans la query string : le fragment n'est ni envoyé au serveur dans l'URL, ni dans le Referer, ni journalisé. **[Mon choix]**
- Base : seule l'empreinte SHA-256 du jeton est stockée. Le jeton clair n'existe qu'à l'écran de création. Un lien perdu = nouvelle invitation. **[Mon choix]**
- Lecture par fonctions `security definer` uniquement (aucun accès `anon` aux tables), qui vérifient jeton, non-retrait, non-expiration, et ne renvoient que l'élève de l'invitation.
- Création et retrait : fonctions `security definer` réservées au propriétaire de l'élève (`auth.uid()` = `dicta_pupils.user_id`) ; pas de lecture de l'empreinte par le client.
- Plafond de tentatives pour deviner un jeton : le jeton a 256 bits, donc la devinette n'est pas réaliste ; une limite par invitation (60 lectures/heure) évite le moissonnage d'un lien volé. **[Mon choix]**
- Réponses `Cache-Control: no-store` ; page `/suivi` avec `noindex` et `Referrer-Policy: no-referrer`.
- Limite assumée : celui qui reçoit le lien peut le transmettre. Le texte de l'invitation le dit, et le retrait est immédiat. **[JF]** (option A)

## 6. Données (esquisse, non appliquée)

Table `dicta_shares` : `id`, `user_id`, `pupil_id` (FK `dicta_pupils`, `on delete cascade`), `label`, `token_hash` (unique), `expires_at`, `revoked_at`, `last_used_at`, `created_at`. RLS : propriétaire en lecture de ses lignes sauf `token_hash` (vue ou colonnes accordées) ; écriture uniquement par les fonctions. Grants Data API explicites dans la même migration, préfixe `dicta_` respecté.

Fonctions : `dicta_share_create(p_pupil_id, p_label, p_expires_at)` renvoie le jeton clair une fois ; `dicta_share_revoke(p_share_id)` ; `dicta_share_view(p_token)` renvoie un JSON borné aux champs du §3 ; accessibles à `anon` pour `view` seulement.

Effets en cascade : supprimer l'élève supprime ses invitations. Une migration n'est appliquée qu'avec l'accord explicite de JF.

## 7. Tests exigés

- Jeton valide : renvoie l'élève invité et rien d'un autre élève du même enseignant (test SQL à deux élèves).
- Jeton retiré, expiré, inexistant, tronqué : même réponse neutre.
- Un autre enseignant ne peut ni créer ni retirer une invitation pour un élève qui n'est pas le sien.
- `view` ne renvoie ni capture, ni commentaire non visible, ni code de dictée.
- Le jeton clair n'est stocké nulle part (colonne, journal, URL côté serveur).
- Interface : lien copié affiché une seule fois ; retrait visible immédiatement ; page `/suivi` lisible à 16 px minimum, sans mur de texte.

## 8. Références (règle RISS)

Aucune référence scientifique n'est citée dans cette fonctionnalité. Si la page invité affiche une phrase d'aide à l'interprétation (« réussi seul / aidé »), elle sera formulée sans affirmation scientifique ; toute citation passera d'abord par `mcp__RISS__search_articles`.

## 9. À dire à l'utilisateur **[Mon choix]**

- Le lien est un secret : qui le possède voit les résultats de cet élève.
- L'app n'envoie rien : c'est l'enseignant(e) qui transmet le lien.
- L'ergo voit des résultats de dictée, pas un diagnostic ; l'interprétation reste à l'enseignant(e) et à l'ergo.
- Le consentement des parents pour partager des résultats avec l'ergo reste géré par la référente PLAI, hors app.

## 10. Laissé à l'implémentation

Mise en page de `/suivi`, wording exact du mailto, nombre de lignes affichées avant « voir plus », structure SQL de la limite de lectures.
