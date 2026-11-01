# Recette du plan 1 : DictéeAccessible

À faire sur la vraie base, après application de la migration (JF a approuvé le SQL) et avec les variables `.env.local` réelles.

Dossier : `C:\Users\jfbeg\OneDrive\claude-workspace\projets\dicteeaccessible`

```bash
cd "C:/Users/jfbeg/OneDrive/claude-workspace/projets/dicteeaccessible"
npm run dev -- --port 5183
```

URL locale : http://localhost:5183 (puis l'URL publique Vercel avec le même scénario).

## Scénario (noter pour chaque point : constaté / déduit / non vérifié)

1. Créer un compte enseignante ou se connecter : http://localhost:5183/enseignant/auth
2. Mes élèves : http://localhost:5183/enseignant/eleves, ajouter 2 codes. Attendu : E1 et E2.
3. Nouvelle dictée : http://localhost:5183/enseignant/session/nouvelle. Titre « Dictée de test », mots `monsieur – peut-être – aujourd’hui – paire`, type « Dictée en classe », E1 et E2 cochés. Attendu : page avec le code de la dictée et un lien + QR par élève.
4. Ouvrir le lien de E1 sur une tablette. Faire une faute volontaire sur un mot, réussir un mot du premier coup. Attendu : retour immédiat, relance automatique après 2 secondes.
5. Avec une dictée en autonomie (option « Montrer la bonne orthographe » active) : utiliser l'aide sur un mot. Attendu : le mot s'affiche, il faut quand même le placer.
6. Terminer le tour A. Attendu : « Dernier tour : sans aide » avec les mots fautés ou aidés seulement.
7. Recharger la page au milieu. Attendu : reprise au mot suivant non réussi.
8. Couper le réseau (mode avion) pendant un mot puis le rétablir. Attendu : bandeau « Enregistrement en attente », disparaît au retour du réseau.
9. Saisir un mauvais code de dictée. Attendu : « Code inconnu. Vérifier les deux codes avec ton enseignante. »
10. Résultats : http://localhost:5183/enseignant/resultats/ puis le titre de la dictée. Attendu pour E1 : une ligne par mot avec la bonne étiquette (réussi du premier coup / repris, maîtrisé au dernier tour / bonne orthographe montrée, non maîtrisé), capture de l'erreur, essais et écoutes ; E2 « Aucune réponse enregistrée ».
11. Écrire un commentaire, régler « Visible par les personnes autorisées », enregistrer, recharger. Attendu : le commentaire et le réglage reviennent.
12. Se connecter avec un second compte enseignante. Attendu : aucune dictée, aucun résultat de la première.

## Déjà constaté (faux serveur local, pas la vraie base)

Voir `.superpowers/` : parcours élève A, aide, coupure réseau, rechargement, tour C, code inconnu ; écrans enseignante avec données fictives ; aucun texte sous 16 px sur la page de création. Ce n'est pas la recette sur la vraie base ni sur tablette.
