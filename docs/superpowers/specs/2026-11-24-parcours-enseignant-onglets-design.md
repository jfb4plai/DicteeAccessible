# Parcours enseignant en onglets (espace de travail par dictée)

Date : 2026-11-24. Statut : brouillon, approbation de JF pendante. Rien codé.

## Intention
Remplacer trois écrans longs (NewSession, SessionSentences, EditSession) par un seul espace de travail par dictée, en onglets, qui indique où en est l'enseignant(e) et la guide avec bienveillance vers la prochaine étape. Choix de JF : approche B, 2026-11-24.

## État actuel (lu dans le code)
- Création : `NewSession.tsx` (251 l.), une page à 3 sections ; une dictée « mots seulement » est publiée dès la création, avec phrases elle reste brouillon.
- Phrases : `SessionSentences.tsx` (317 l.), génération IA, reprise, validation, publication.
- Modification : `EditSession.tsx` (219 l.), réglages, mots, élèves ; lien vers les phrases.
- Résultats : `SessionResults.tsx`, page séparée (inchangée).

## Buts / non-buts / anti-buts
- But : un seul modèle mental pour créer et modifier ; progression visible ; aide à chaque champ conservée (label, exemple, texte d'aide).
- Non-but : toucher à l'espace élève, aux résultats, à la base de données (aucune migration).
- Anti-but : perdre une saisie en changeant d'onglet ; publier une dictée incomplète.

## Structure
Route `/enseignant/session/:id` (onglet dans `?onglet=`). `/enseignant/session/nouvelle` ne garde qu'un court formulaire de départ (titre, niveau, contenu : mots / mots + phrases / phrases ; mots) qui crée la dictée **en brouillon** puis ouvre l'espace de travail. Anciennes routes `/:id/phrases` et `/:id/modifier` redirigent vers l'espace.

Onglets, dans l'ordre :
1. **Contenu** : titre, niveau, mots (lignes modifiables, comme EditSession).
2. **Réglages** : type (classe / autonomie), voix, mots parasites 0–3, options.
3. **Phrases** : génération IA, reprise, relecture, validation (l'onglet reste visible sans phrases, marqué « facultatif »).
4. **Élèves** : choix et création de codes.
5. **Publier** : liste de contrôle de ce qui manque, bouton Publier, puis code et liens/QR des élèves.
6. **Résultats** : carte courte et bouton vers la page de résultats existante.

## Accompagnement
- Barre d'onglets avec coche par onglet complet. Complet : Contenu = titre + au moins un mot ou une phrase ; Phrases = toutes validées (si présentes) ; Élèves = au moins un ; Publier = publiée. Réglages : valeurs par défaut valides, coche d'office.
- Bandeau « Prochaine étape » en haut, au ton encourageant, vers le premier onglet requis incomplet.
- Chaque onglet : une phrase d'accueil (ce qu'on fait ici et pourquoi), bouton « Enregistrer et continuer » vers l'onglet suivant.
- Changer d'onglet n'efface rien : l'état vit dans l'espace de travail ; une saisie non enregistrée déclenche un rappel avant de quitter.
- Après publication, les onglets restent modifiables, avec l'avertissement de partage déjà écrit (dictée générée pas forcément partagée ; mots retirés = résultats perdus).
- « Mes dictées » vide : étapes « 1. Créer des codes élèves, 2. Créer une dictée ».

## Contraintes
- Publier exige au moins un élève et, si phrases, toutes validées (le déclencheur SQL existe déjà).
- Création en brouillon sans élèves : `createSession` n'insère plus de lignes élèves vides ; la validation « au moins un élève » passe à la publication.
- Typographie sans empattements, 16 px minimum, cibles tactiles 44 px, onglets accessibles au clavier (rôle tablist/tab/tabpanel).
- `npx vite build` avant `git push` ; mode d'emploi mis à jour.

## À la charge du constructeur
Découpage en composants par onglet, tests de la logique pure (complétude des onglets, prochaine étape, redirections), recette réelle avec le compte de JF (non faite à ce jour).
