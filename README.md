# DictéeAccessible

Dictées de mots et de phrases accessibles, P1 à P6 (FWB). L'élève répond par tuiles à placer, chaque réponse est enregistrée mot par mot pour que l'enseignante la relise.

Copie de Dictée Interactive (l'original reste intact). Spécification : `docs/superpowers/specs/`. Plans : `docs/superpowers/plans/`.

## Lancer

```bash
npm install
cp .env.example .env.local   # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev
```

## Tester

```bash
npm test
npx vite build
```

## Licences

- Code : PolyForm Noncommercial 1.0.0 (`LICENSE`).
- Contenus pédagogiques : CC BY-NC-SA 4.0 (`LICENSE-CONTENT.md`).
- Logo et identité visuelle PLAI : tous droits réservés.

Auteur : Jean-François Beguin, https://jfb4plai.com
