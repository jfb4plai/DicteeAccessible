# Recette du plan 4 : accès externe sur invitation

Dossier de l'app : `C:\Users\jfbeg\OneDrive\claude-workspace\projets\dicteeaccessible`
Prérequis : migration `supabase\migrations\20261104120000_dicta_shares.sql` appliquée sur Flashfwb et test `supabase\tests\dicta_shares_test.sql` exécuté sans erreur.

Cocher « constaté » seulement après avoir vu le résultat à l'écran.

| # | Étape | Où | Attendu | Constaté |
|---|---|---|---|---|
| 1 | Se connecter en enseignant(e) | https://dicteeaccessible.vercel.app/enseignant/auth | Tableau de bord | |
| 2 | Ouvrir « Mes élèves », descendre à « Inviter une personne à suivre un élève » | https://dicteeaccessible.vercel.app/enseignant/eleves | Formulaire avec élève, nom d'usage, fin de l'accès (31 août) | |
| 3 | Choisir E1, nom « Ergo, Mme Test », garder la date, cliquer « Créer le lien » | idem | Un cadre vert montre le lien `…/suivi#t=…` et l'avertissement « Ce lien ne sera plus affiché » | |
| 4 | Cliquer « Copier le lien », puis « Écrire un e-mail » | idem | « Lien copié. » ; la messagerie s'ouvre avec un message sans code ni prénom d'élève | |
| 5 | Ouvrir le lien dans une fenêtre de navigation privée (sans connexion) | lien copié | Page « Résultats de l'élève E1 », bandeau « Lecture seule », bloc « À revoir », une carte par dictée où E1 a répondu | |
| 6 | Vérifier ce qui est visible et invisible | idem | Aucune image, aucun code de dictée, aucun autre élève ; le commentaire n'apparaît que s'il est coché « Visible par les personnes autorisées » | |
| 7 | Ouvrir `https://dicteeaccessible.vercel.app/suivi` (sans fragment) | | Message « Cet accès n'est plus valable… », sans clignotement ni erreur technique | |
| 8 | Revenir dans « Mes élèves », cliquer « Retirer l'accès » | | L'invitation passe à « retirée » ; « Dernière consultation » affiche la date du jour | |
| 9 | Recharger la page privée de l'étape 5 | | Message « Cet accès n'est plus valable… » | |
| 10 | Refaire 3 à 5 sur une tablette (ouvrir le lien reçu par e-mail) | tablette | Page lisible à 16 px, sans défilement horizontal | |

Hors recette (non testé par l'app) : consentement des parents pour partager des résultats avec l'ergothérapeute, géré par la référente PLAI.
