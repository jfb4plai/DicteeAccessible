# DictéeAccessible (nom fixé par JF le 2026-11-01) : spécification de conception

Date : 2026-11-01. Statut : approuvée par JF le 2026-11-01. Rien n'est codé, aucune migration appliquée.

Légende : **[JF]** = décidé par JF. **[Mon choix]** = décision prise par moi, à contrôler. **[Hypothèse]** = non vérifié.

## 1. Intention et origine

Une élève de P3, lente à l'écriture manuscrite, est autorisée par l'ergothérapeute à utiliser une tablette pour les dictées de mots. L'enseignante ne peut pas surveiller toute la dictée : les résultats doivent être enregistrés pour être relus après. Le même outil doit aussi permettre de préparer les dictées en autonomie, y compris l'autodictée (la clé pour cette enseignante). L'accord des parents est géré par la référente PLAI de l'école, hors application.

Calendrier connu : dictée de mots le 16/11, autodictée le 23/11, dictée de mots le 30/11. **[JF]** « On verra » pour les dates : aucun engagement, voir §11.

L'outil doit servir à tout enseignant de P1 à P6, pas seulement à ce cas. **[JF]**

## 2. Objectifs, non-objectifs, contre-objectifs

Objectifs :
- Préparer en autonomie (mots puis phrases) et passer la dictée en classe sur le même outil.
- Enregistrer chaque réponse mot par mot, consultable ensuite par l'enseignante et, si elle le décide, par des personnes extérieures.
- Réduire l'effort d'écriture manuscrite sans réduire l'exigence orthographique.
- Respecter les 4 principes PLAI : inclusion, IA = amplificateur (l'enseignante valide et personnalise), validation RISS, ancrage FWB.

Non-objectifs (v1) :
- Pas de note ni de conclusion automatique sur l'élève.
- Pas de clé API propre à l'enseignant, pas d'invitation par e-mail (v2). **[JF]**
- Pas de modification de l'application Dictée Interactive existante.

Contre-objectifs (échec même si « ça marche ») :
- L'enseignante accepte les phrases de l'IA sans les lire.
- L'élève mémorise une orthographe fausse affichée par l'outil.
- Un prénom d'élève circule dans l'URL, la base ou une capture.
- L'outil donne l'impression d'un test noté à un enfant déjà en difficulté.

## 3. Contraintes

- Webapp, tous systèmes dont ordinateurs, tablettes comprises. **[JF]**
- Base technique : copie de `projets/PLAI-French-Interactive-dictation` (React 18, Vite, TypeScript, Tailwind, Supabase, Vercel). Nouvelle app copiée, l'existante reste intacte. **[JF]**
- Tables Supabase préfixées (préfixe provisoire `dicta_`), grep des conflits avant tout `create table`, `GRANT` Data API et RLS dans la même migration. Le SQL est montré à JF avant application. **[JF]** pour la règle.
- Branche `main`. `npx vite build` doit passer avant tout push.
- Clés (Anthropic, ElevenLabs) côté serveur uniquement (`/api/*`), jamais dans le frontend ni dans un log.
- Interface : Arial, 16 px minimum, contraste suffisant, branding PLAI (teal #0f6e56, orange #f97316), logo avec hauteur fixée seulement. Chaque champ : label, placeholder concret, aide sur l'effet de la saisie.
- Exemples et vocabulaire FWB (P1-P6, pas de « CE1 »). Consignes élèves à l'infinitif, une action par puce.
- Élève identifié par un code anonyme (ex. E1), jamais par un prénom, ni en URL ni en base. **[JF]**

## 4. Les deux usages

### 4.1 Préparation en autonomie **[JF]**

Parcours en 4 étapes, l'élève avance seule :

| Étape | Contenu | Aide |
|---|---|---|
| A | Chaque mot, lettres à placer (logique Dictée Interactive : retour immédiat, nouvel essai, capture d'écran en cas d'erreur) | écoute du mot |
| B1 | Phrase visible, tuiles de mots à ordonner | écoute de la phrase |
| B2 | Phrase cachée (par cœur), tuiles de mots + mots parasites | écoute de la phrase |
| C | Mots « non maîtrisés » seulement, sans aide | aucune |

B1 et B2 ne démarrent pour une phrase que si ses mots ont été vérifiés en A. **[JF]**

### 4.2 Dictée en classe **[JF]**

- Dictée de phrases (autodictée) : B2, avec d'autres parasites que ceux de la préparation.
- Dictée de mots : au choix de l'enseignante, lettres à placer (comme A) ou tuiles de mots.
- Chaque réponse est enregistrée au moment où elle est donnée, pas à la fin de la séance.
- Option « Montrer la bonne orthographe » désactivée par défaut en classe. **[Mon choix]**

### 4.3 « Montrer la bonne orthographe » **[JF]**

Option par session. Si l'élève l'utilise : le mot est signalé à l'enseignante, marqué « non maîtrisé », et revient à la fin (étape C). La logique Dictée Interactive est reprise telle quelle pour les lettres erronées (affichées en rouge avant remise à zéro). Risque RISS noté (voir §10) ; décision de JF.

### 4.4 Mots parasites **[JF]** pour le principe

- Avec une règle « é ou er » : parasites = autres formes du même verbe (-é, -ée, -er, -ez), proposées par l'IA et validées par l'enseignante.
- Sans règle : mots proches choisis par l'enseignante (ex. vent / vend).
- Le code vérifie seulement qu'un parasite n'est égal à aucun mot de la phrase. Que la forme soit correcte ou discriminante n'est pas vérifiable par code.
- Le parasite n'est pas visuellement marqué pour l'élève.

## 5. IA : génération des phrases

- Entrée : mots, niveau (P1-P6), règle facultative, contexte de classe facultatif. Sortie : une phrase par mot ou groupe de mots, avec parasites proposés.
- Modèle : Haiku 5.5 (`claude-haiku-5-5`), sortie JSON structurée (`output_config.format`), appel via `/api/*` Vercel. **[JF]** pour le principe, **[Mon choix]** pour le modèle (règle du CLAUDE.md projet).
- Contrôles par code : le mot cible figure dans la phrase ; longueur compatible avec le niveau ; aucun parasite égal à un mot de la phrase.
- Split 80/20 **[JF]** : les phrases arrivent dans une zone éditable ; la case « validée » est obligatoire pour chaque phrase ; « Publier » reste désactivé tant qu'une phrase n'est pas validée. Aucun enregistrement direct du résultat IA.
- Ton : pas de préambule IA dans les textes affichés (déclaudisation).
- Phrases FWB (vocabulaire, lieux, situations de la classe fournis par l'enseignante).

## 6. Voix **[JF]**

- Voix belge via ElevenLabs. Audio généré une fois, mis en cache (clé = texte + voix), servi ensuite sans nouvel appel.
- **[Hypothèse]** Une voix belge adaptée existe et son usage est autorisé par la licence et le tarif : non vérifié. À contrôler par un script local (JF a la clé ; elle n'est jamais collée dans le code ni dans le chat).
- Voix retenues par JF (2026-11-01) : Adrien (voix belge du compte) ou « jef » (voix clonée de JF, catégorie « cloned » ; la voix « JF » du compte est « generated », donc distincte). Choix par défaut à fixer avant le plan 3 ; la voix reste réglable par l'enseignant(e). Écartées : Christophe Géradon, Léa, Anaïs, Sand (essais du 2026-11-01).
- Repli : voix du navigateur (comme Dictée Interactive, `speech.ts`) si l'audio est indisponible.
- La lecture à haute voix des consignes est facultative pour l'élève. **[JF]**

### 6.1 Règle de lecture des nombres (français de Belgique) **[JF]**, ajoutée le 2026-11-01

Avant tout appel de synthèse vocale, le serveur remplace chaque nombre écrit en chiffres par ses mots, selon l'usage belge. La voix lit alors le mot écrit, quelle que soit sa propre habitude (Léa, voix parisienne, ne dit pas « nonante » d'elle-même : non constaté, à vérifier à l'oreille).

- Portée (étendue le 2026-11-01 sur demande de JF : pour ces élèves, la lecture doit être conforme au programme) :
  - entiers de 0 à 999 999 999 999, écrits en chiffres seuls ou en groupes séparés par une espace, une espace insécable ou un point (« 75 000 », « 75.000 », « 1 000 000 » → « un million », « 3 000 000 000 » → « trois milliards ») ;
  - décimaux à virgule : « 3,5 » → « trois virgule cinq », « 1,70 » → « un virgule septante », « 1,05 » → « un virgule zéro cinq » ; au-delà de trois décimales, chiffre par chiffre ;
  - euros : « 1,70 € » → « un euro septante », « 2,50 € » → « deux euros cinquante », « 5 € » → « cinq euros » ; pourcentages : « 50 % » → « cinquante pour cent » ;
  - ordinaux : « 1er » → « premier », « 1re » → « première », « 2e » → « deuxième », « 71e » → « septante et unième », « 80e » → « quatre-vingtième », « 90e » → « nonantième », avec pluriel (« 2es ») ;
  - périodes : « 1990-2024 » → « mille neuf cent nonante à deux mille vingt-quatre » (tiret collé à deux nombres) ;
  - dates complètes : « 16/11/2024 » → « seize novembre deux mille vingt-quatre », « 1/2/2025 » → « premier février deux mille vingt-cinq » ;
  - heures : « 9 h 30 », « 14h05 », « 10:30 » → « neuf heures trente », « quatorze heures cinq », « dix heures trente » ; « 1 h » → « une heure ».
- Formes : 70 « septante », 90 « nonante », 80 « quatre-vingts » (« quatre-vingt » devant un autre nombre). « et un » pour 21, 31, 41, 51, 61, 71, 91 ; pas de « et » pour 81 (« quatre-vingt-un »). Pluriel de « cent » sauf devant un autre nombre (« deux cents », « deux cent un »). « Million » et « milliard » prennent le « s » (« quatre-vingts millions »).
- Laissés tels quels : nombres collés à des lettres (« A4 »), nombres à zéro initial (« 007 »), nombres de plus de 12 chiffres, décimaux à point (« 3.5 »), dates sans année (« 16/11 », « 1/2 » : une fraction est possible), heures ou minutes impossibles (« 10:70 »).
- Pas de lookbehind dans les expressions régulières (iOS avant 16.4 refuse de charger un fichier qui en contient) : un test l'interdit.
- Limites (à dire aux enseignant(e)s) : les unités (« km », « g », « cm », « l ») et les numéros de téléphone ne sont pas traités ; leur lecture dépend de la voix.
- Le texte converti est celui qui sert de clé de cache audio, avec la voix. Le texte affiché à l'élève n'est jamais modifié.
- Réalisation : plan 3 (voix), fonction pure `numbersToBelgianWords(text: string): string` testée avant toute synthèse.
- Constaté par JF à l'oreille le 2026-11-01 : ni Adrien ni Christophe Géradon (voix belges) ne lisent « 70 » et « 90 » en chiffres à la belge. Le passage chiffres vers mots dépend du modèle, pas de l'accent de la voix : la conversion par notre code est donc obligatoire, pour toutes les voix.
- Réalisation : plan 3 (voix), avec la fonction pure `numbersToBelgianWords(text: string): string` testée avant toute synthèse.

### 6.2 Lexique de prononciation belge **[JF]**, ajouté le 2026-11-01

Constaté à l'oreille par JF (2026-11-01) : avec Adrien et Christophe Géradon, « wagon » est lu « vagon » et « 90 » à la française ; seule la version réécrite (« ouagon », « Ouallonie », « ouallon ») est correcte. Le modèle applique la norme française, l'accent de la voix n'y change rien. Même remède que pour les nombres : changer le texte envoyé, jamais le texte affiché.

- Fonction pure `toBelgianSpeech(text: string): string` = `numbersToBelgianWords` (§6.1) puis remplacement des mots du lexique. Elle est appelée avant le calcul de la clé de cache audio et avant l'appel à ElevenLabs.
- Lexique de départ (mots entiers, sans tenir compte de la casse, majuscule initiale conservée, pluriels et féminins inclus) : wagon, wagons → ouagon, ouagons ; Wallonie → Ouallonie ; wallon, wallons, wallonne, wallonnes → ouallon, ouallons, ouallonne, ouallonnes. Constaté par JF pour wagon, Wallonie et wallon (version réécrite correcte).
- Non testé : « week-end » (le « w » est déjà /w/ en France). Tout autre mot en « w » est laissé tel quel tant qu'il n'est pas validé à l'oreille.
- Chaque entrée est validée à l'oreille par JF ou une enseignante belge avant d'entrer dans le lexique ; le lexique est un fichier de données, pas du code.
- Tests : « Un wagon. » → « Un ouagon. » ; « La Wallonie » → « La Ouallonie » ; « Wagons » → « Ouagons » ; « kiwi » inchangé ; « Il a 90 ans, un wagon. » → « Il a nonante ans, un ouagon. ».
- Hors décision (à proposer plus tard) : corrections de prononciation ajoutées par l'enseignant(e), dictée par dictée.


## 7. Clés **[JF]**

- v1 : clé PLAI côté serveur, avec un plafond de requêtes par enseignant (valeur à fixer, **[Mon choix]** : plafond journalier modeste, message clair quand il est atteint).
- v2 : l'enseignante peut saisir sa propre clé (stockée chiffrée côté serveur).
- Changement de clé aisé **[JF]** : les clés sont des variables d'environnement Vercel ; en changer une = modifier la variable et redéployer, sans toucher au code. Le script local de test de la voix lit la clé dans une variable ou un fichier `.env` ignoré par Git.

## 8. Résultats et partage

### 8.1 Écran de résultats (maquette : `projets/dicteeaccessible/maquettes/ecran-enseignant-v2.html`)

- Une ligne par mot : pastille verte (réussi seul), orange (repris ou aidé), rouge (non maîtrisé à la fin), + une phrase de statut. Un clic ouvre le détail : écrit au premier essai, nombre d'essais, écoutes, capture. **[JF]** : simplifier visuellement, pas opérationnellement.
- En-tête : « n sur N réussis du premier coup » présenté comme information, pas comme note ; nombre de mots à revoir.
- Pas de durée de la séance ni de temps par mot (pas de pression). **[Mon choix]**
- Les écoutes sont comptées par mot. **[Mon choix]**
- Les données de la maquette sont fictives.

### 8.2 Commentaire de l'enseignante

- Champ libre par dictée ; l'enseignante interprète, l'application ne conclut rien. **[JF]**
- Visibilité aux personnes autorisées : au choix de l'enseignante, pour chaque dictée. **[JF]** Valeur par défaut : privé. **[Mon choix]**

### 8.3 Accès externe (ergothérapeute, parents)

- v1 : accès par élève, en lecture seule, par code ou QR, révocable, avec date d'expiration (par défaut la fin de l'année scolaire). **[JF]** pour « par élève », **[Mon choix]** pour le mécanisme ; JF a demandé un accès par invitation e-mail avec code ou QR, reporté en v2.
- Contenu visible : liste des mots et détail ; le commentaire seulement s'il est marqué visible.
- Aucune donnée permettant d'identifier l'élève (seulement le code anonyme).
- Le code d'accès est tiré au hasard, assez long pour ne pas être devinable ; l'accès côté serveur est vérifié (pas seulement caché dans l'interface).

## 9. Modèle de données (esquisse, non appliquée)

Tables prévues (préfixe `dicta_`, noms à confirmer après grep) :
- `dicta_pupils` : enseignante (user_id), code anonyme (E1, E2…). Aucun nom.
- `dicta_sessions` : enseignante (user_id), titre, niveau, type (autonomie / classe), options, statut ; élèves concernés (un à toute la classe).
- `dicta_items` : session, mot, phrase, parasites, validé (booléen), ordre.
- `dicta_attempts` : session, élève, item, étape (A/B1/B2/C), réponse, correct, aide utilisée, écoutes, horodatage, capture (référence).
- `dicta_comments` : session, élève, texte, visible (booléen).
- `dicta_shares` : élève, code d'accès, expiration, révoqué (accès externe par élève, toutes ses dictées).

RLS : propriétaire = `auth.uid() = user_id` ; accès externe par fonction côté serveur vérifiant le code, la révocation et l'expiration (pas de politique auto-référentielle : fonction `security definer`). Élève : accès sans compte via un jeton de session, à préciser dans le plan. **[À préciser par le constructeur]**

Conservation : année scolaire, puis suppression ou archivage. **[JF]**

## 10. Références (règle RISS)

Lues par extraits seulement (corpus RISS) ; plusieurs sont des mémoires de master ; à ne citer dans l'app qu'après lecture complète ou avec la mention de leur nature :
- hal-04759778, Broc & Caillet 2024 : clavier et troubles d'acquisition de l'écriture.
- dumas-05497857, Davodeau 2023 : outils informatiques et correcteur orthographique.
- hal-01884942, Broyez 2010 : risque de mémoriser une orthographe erronée.
- dumas-01076552, Espalier & Guillaud 2014 : copie et dictée.

Aucune source RISS sur l'autodictée en autonomie : « hors corpus RISS ». Les références légales (décret sur les aménagements raisonnables, etc.) ne sont pas vérifiées et ne sont pas citées.

## 11. Découpage et calendrier

Ordre **[Mon choix]**, sans engagement de date **[JF]** :
1. Socle : copie, tables, authentification enseignante, session, étape A, enregistrement mot par mot, écran de résultats.
2. Phrases IA, B1, B2, C, dictée de phrases en classe.
3. Voix ElevenLabs (après vérification de la voix belge).
4. Accès externe, vignette portail, mode d'emploi HTML PLAI.
5. v2 : clé propre à l'enseignante, invitation par e-mail.

Si l'objectif est la dictée de mots du 16/11 : l'étape 1 seule le permet, avec la voix du navigateur. Aucune date n'est promise.

## 12. Tests et vérifications

- Logique pure (parasites, contrôle du mot cible, statuts) : tests unitaires.
- Parcours élève A → B1 → B2 → C testé de bout en bout sur tablette et ordinateur, à `localhost` avec `vercel dev` (pas `vite dev` : `/api/*` ne tourne pas).
- Fonctions `/api/*` testées avec une clé de test ; contrôle qu'aucune clé n'apparaît dans le bundle.
- Accès externe : tester un code révoqué, expiré, inexistant.
- Recette avec l'enseignante réelle avant de dire que l'outil convient : à ce jour, aucun test réel.

## 13. Points tranchés et ouverts (2026-11-01)

Tranchés par JF :
- Une session peut servir de un élève à toute la classe ; un code anonyme par élève (E1, E2…), créé par l'enseignante. Les résultats sont affichés par élève, avec une vue de classe.
- Accès externe par élève (toutes ses dictées), pas par dictée.
- Test de la voix belge ElevenLabs par script local : accord. La clé doit être facile à changer : elle est lue dans une variable d'environnement (Vercel côté serveur, fichier local ignoré par Git pour le script), jamais écrite dans le code.
- Nom : « DictéeAccessible » (orthographe confirmée par JF). Il rompt avec le suffixe « -Actif » de la nomenclature PLAI ; sous-domaine et repo à fixer sur ce nom.

- Copie : nouvelle app copiée de Dictée Interactive, l'existante reste intacte. **[JF]** (confirmé le 2026-11-01).

Encore ouvert :
- Sous-domaine à fixer.

Réglés par moi, à contrôler : entrée de l'élève sans compte (code de session + code anonyme, comme Dictée Interactive sans prénom dans l'URL) ; captures d'erreur stockées côté serveur avec la même durée de conservation que les résultats ; plafond de requêtes IA par enseignant.

## 14. Limites à dire à l'utilisateur

- B1 apporte peu (recopie d'une phrase visible) ; B2 mesure la reconnaissance et la discrimination, pas le rappel orthographique d'un mot.
- Le nombre de phrases à relire alourdit la préparation de l'enseignante.
- L'outil n'évalue pas l'écriture manuscrite ; il ne remplace pas l'avis de l'ergothérapeute.
- Aucun test réalisé avec une élève ni avec l'enseignante à ce jour.
