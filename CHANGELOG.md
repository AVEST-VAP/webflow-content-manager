# Changelog — Webflow Content Manager

> Journal de bord du projet. Chaque évolution est documentée ici par date.
> Mettre à jour ce fichier à chaque commit significatif.

---

## [1.6.0] — 2026-02-27

### Ajouté

- **Mode Exploration (Inspector)** — Bouton chip `[⌖ Inspect]` dans le header avec tooltip au hover. Quand actif, un panneau fixe en bas de l'extension affiche les infos de l'élément sélectionné dans le Designer : `data-wording-key`, `data-wording-mode`, valeur résolue depuis le fichier chargé, et type d'élément Webflow. 3 états : aucun élément, élément sans attribut, élément avec clé.
- **Toggle thème light/dark** — Remplacement du bouton emoji par un vrai toggle switch (slider) avec ☀️ et 🌙 de chaque côté.
- **Header restructuré sur 2 lignes** — Ligne 1 : logo + titre / site info. Ligne 2 : badges (LOCAL, Inspect) / toggle thème. Plus aéré et lisible.

### Fichiers créés

- `src/hooks/useElementInspector.ts` — Hook qui subscribe à `webflow.subscribe('selectedelement')`, lit les attributs custom et résout la valeur
- `src/components/ElementInspector.tsx` — Panneau d'affichage fixe en bas, 3 états

### Fichiers modifiés

- `src/App.tsx` — Header 2 lignes (`app-header-top` / `app-header-bottom`), toggle thème switch, intégration inspector
- `src/styles.css` — Theme switch (slider), inspector (toggle chip + tooltip + fixed bottom panel), header layout 2 lignes

---

## [1.5.0] — 2026-02-27

### Ajouté

- **Détection des clés dupliquées** — Le parser CSV détecte les clés qui apparaissent plusieurs fois et affiche un avertissement jaune (informatif, ne bloque pas le scan). Dernière valeur conservée.
- **Notifications webflow.notify()** — Toast natif dans le Webflow Designer après chaque scan (Info) et déploiement (Success/Error).
- **Auto-détection email/téléphone/openInNewTab en mode lien** — Le mode `link` détecte automatiquement :
  - Email → `setSettings('email', ...)`
  - Téléphone → `setSettings('phone', ...)`
  - URL externe → `setSettings('url', { openInNewTab: true })`
  - Chemin relatif (`/...`) → lien interne
  - Sinon → recherche de page Webflow par nom
- **Aperçu organisé par section** — Les clés sont groupées par section (extraite de la notation pointée, ex: `home.hero.title` → section "hero") dans l'aperçu, avec en-tête et badge de comptage.
- **Métadonnées SEO depuis le CSV** — Convention `_seo.` pour définir les métadonnées de page :
  - `home._seo.title` → `page.setTitle(...)`
  - `home._seo.description` → `page.setDescription(...)`
  - Les clés SEO n'apparaissent plus comme "clés non utilisées"
  - Badge "SEO" sur les pages concernées dans l'aperçu
  - Section SEO dédiée dans les résultats de déploiement

### Fichiers modifiés

- `src/utils/csvParser.ts` — `parseCSVWithDuplicates()`, interfaces `DuplicateKey`, `CSVParseResult`
- `src/utils/constants.ts` — Regex link, constantes SEO, constantes preview
- `src/hooks/useAppState.ts` — `duplicateKeys`, `SectionGroup`, `SeoEntry`, `seoKeys` sur `PagePreview`
- `src/types.ts` — `SeoChange`, `seoChanges` sur `DeploymentReport`
- `src/services/deployer.ts` — Link auto-détection, SEO extract/apply, filtrage unused keys
- `src/components/InputSection.tsx` — Warning clés dupliquées
- `src/components/PreviewSection.tsx` — Groupement par section, SEO preview
- `src/components/ResultSection.tsx` — Section résultats SEO
- `src/App.tsx` — `webflow.notify()`, passage `duplicateKeys`, `seoChanges`

---

## [1.4.0] — 2025-05-xx

### Ajouté

- **Mode placeholder** — Support de `data-wording-mode="placeholder"` pour les inputs de formulaire.
- **Badge LOCAL** — Indicateur visuel quand l'extension tourne en localhost.

### Commit

`d214251d feat: add placeholder mode and local badge indicator`

---

## [1.3.0] — 2025-05-xx

### Modifié

- **UX Import et Résultats** — Amélioration de l'interface d'import CSV (drag & drop, état de succès) et de la section résultats (détails par page, téléchargement du rapport JSON).

### Commit

`5f86c3a8 feat(ui): Enhance Import and Result UX`

---

## [1.2.0] — 2025-05-xx

### Ajouté

- **Internationalisation en français** — Toute l'interface est maintenant en français.
- **Nouveau logo** — Logo Avest intégré.

### Commit

`7d07cc25 feat: internationalize app to French and update logo`

---

## [1.1.0] — 2025-05-xx

### Ajouté

- **Structure de base** — Architecture complète : `App.tsx`, composants (`InputSection`, `PreviewSection`, `ProgressSection`, `ResultSection`, `ErrorBoundary`), hooks (`useAppState`, `useSiteInfo`), services (`deployer.ts`, `csvParser.ts`), types, constantes.
- **CLAUDE.md** — Documentation des conventions du projet.
- **Scan multi-pages** — Scan de toutes les pages ciblées avec progression.
- **Déploiement multi-pages** — Application des changements sur plusieurs pages.
- **Import CSV & JSON** — Deux modes d'import du contenu.
- **Modes text, html, link** — Support initial des modes de remplacement.

### Commit

`ae7a383e chore: update .gitignore, add CLAUDE.md documentation, and implement core application structure`

---

## [1.0.0] — 2025-05-xx

### Ajouté

- **Commit initial** — Scaffolding du projet, configuration Webpack, extension Webflow.
- **Design professionnel** — Thème vert, styles CSS.

### Commits

- `429dc979 feat: redesign app with professional green theme and update title`
- `6b6d2723 Initial commit: Webflow Content Manager`
