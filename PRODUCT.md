# Product

## Register

product

## Users

Deux profils :
- **Enseignants FWB** qui créent des sessions de dictée (liste de mots, images-indices, mode clavier complet vs lettres mélangées, lettres parasites, mode prononciation, pré-remplissage) et consultent les résultats de leurs élèves.
- **Élèves du primaire/secondaire**, y compris porteurs de troubles d'apprentissage (dyslexie, TDAH, troubles DYS), qui complètent une dictée interactive lettre par lettre avec synthèse vocale, en autonomie sur tablette ou ordinateur, souvent en classe pendant que l'enseignant supervise plusieurs élèves à la fois.

## Product Purpose

Remplacer la dictée papier classique par un exercice interactif auto-corrigé : l'app énonce le mot, l'élève reconstitue le mot lettre par lettre (aide adaptative selon le profil), reçoit un feedback immédiat, et les résultats (score, tentatives, captures d'erreurs) sont envoyés automatiquement à l'enseignant. Succès = l'élève reste dans le flux de l'exercice sans confusion sur l'état du jeu, et l'enseignant peut ajuster la difficulté sans manipulation technique.

## Brand Personality

Rassurant, ludique, encourageant — jamais punitif face à l'erreur (cohérent avec la gamification existante : score, trophée, défi bonus). Non confirmé avec l'utilisateur — hypothèse à ajuster si besoin.

## Anti-references

Éviter tout ce qui recrée le stress de l'évaluation papier traditionnelle : silence après une action sans feedback, surcharge visuelle, texte long à lire pour un élève en difficulté de lecture.

## Design Principles

- Feedback immédiat et synchronisé (visuel + auditif) après chaque action de l'élève — jamais de délai mort après un clic.
- Une seule source de vérité pour l'état du jeu à l'écran ; l'élève ne doit jamais se demander "est-ce que ça a marché ?".
- L'erreur est un ralentisseur, pas un mur : retour rapide à l'action suivante possible.
- Accessibilité avant esthétique (dyslexie, TDAH) : pas de surcharge cognitive, respect du mouvement réduit.

## Accessibility & Inclusion

Public incluant élèves dyslexiques et TDAH (cadre PLAI/FWB). Feedback multimodal requis (visuel + auditif). `prefers-reduced-motion` à respecter pour les animations (bounce, shake, spin) actuellement non gérées dans le code.
