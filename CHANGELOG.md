# Changelog — Webflow Content Manager

> Journal de bord du projet. Chaque évolution est documentée ici par date.
> Mettre à jour ce fichier à chaque commit significatif.

---

## [1.7.0] — 2026-06-16

### Ajouté

- **Audit pré-vol (pre-flight)** — Un panneau au-dessus de l'aperçu, recalculé à la volée, qui croise le contenu chargé avec les éléments réellement tagués sur le site **avant** de déployer. Il remonte :
  - **Fautes de frappe probables** — une clé du fichier proche (1-2 caractères, distance de Levenshtein) d'une clé taguée mais différente. Évite la moitié des allers-retours.
  - **Non-modifiables par l'API Webflow** — champs de formulaire / boutons submit dont le placeholder ou le libellé est réservé (à saisir manuellement) — pré-signalés **avant** le déploiement, plus en erreur après.
  - **Clés sans élément** — présentes dans le fichier mais non taguées (ne s'appliqueront pas).
  - **Éléments sans valeur** — tagués sur le site mais absents du fichier.
  - Affiche « Pré-vol : tout est cohérent » quand rien n'est détecté.

### Architecture (DRY / SoC)

- `src/services/auditor.ts` — `auditContent()` **pur**, zéro appel API : analyse testable, isolée du I/O et de l'UI (typée structurellement pour ne dépendre d'aucun hook).
- `src/utils/levenshtein.ts` — distance d'édition réutilisable.
- `src/utils/wordingKeys.ts` — `isSeoKey()` partagé par le deployer **et** l'audit (source unique de la règle).
- `src/components/AuditSection.tsx` — présentation pure (sous-composants `AuditGroup` / `KeyList`).
- `Change` (enrichi de `type`/`mode`) centralisé dans `types.ts` → fin de la duplication deployer/useAppState ; le scan capture désormais le type Webflow de chaque élément.
- Validé sur le site réel (12 pages) : **17 clés manquantes, 0 faux positif de typo, 8 champs non-modifiables** correctement pré-signalés.

### Revue / nettoyage (multi-dimensions avant `main`)

- **Centralisation des types** — `SeoEntry`, `PagePreview`, `PreviewSummary`, `PreviewData`, `SectionGroup`, `ScanProgress` (+ nouveau `ScanResult`) déplacés dans `types.ts` (source unique), re-exportés depuis `useAppState`. `scanAllPages`/`deployToAllPages` n'utilisent plus de types anonymes dupliqués.
- **SoC** — `deployToAllPages` retourne directement un `DeploymentReport` (assemblage sorti de `App.tsx`) ; `ContentManager.isMultiPage()` encapsule la détection multi-page (plus de convention de clé dupliquée dans le composant).
- **Clean-code / règles** — logs `safeCall` derrière `DEBUG_DEPLOY` (off) ; magic strings de mode → `WORDING_MODES` ; constante `SINGLE_PAGE_NAME` partagée ; suppression du type mort `WordingMode` et d'un `successPages` mort ; commentaires en anglais.
- **Correctness** — téléphone normalisé (espaces/points/parenthèses retirés) ; `stats.missing` compté par élément (cohérent avec l'aperçu) ; valeur SEO vide autorisée (peut vider un title/description) ; guard in-flight sur l'inspecteur ; précision de l'audit (variantes numérotées exclues des fautes de frappe) ; clés React stables dans `ProgressSection`.
- `npm run typecheck`, `npm run lint`, `npm run build` à 0 erreur.

---

## [1.6.1] — 2026-06-15

> Correctif anti-freeze + audit complet de l'extension (33 problèmes corrigés, vérifiés contre les typings officiels `@webflow/designer-extension-typings`). `npm run typecheck`, `npm run lint` et `npm run build` passent à 0 erreur.

### Corrigé — Anti-freeze & diagnostic

- **Freeze du déploiement sur un élément** — Un appel à l'API Webflow Designer qui ne se résolvait jamais gelait toute la boucle de déploiement indéfiniment (spinner bloqué à 0 %, le `try/catch` ne se déclenchait pas car la promesse ne rejetait jamais). Chaque appel passe désormais par `withTimeout` : au-delà de `ELEMENT_WRITE_TIMEOUT_MS` (8 s), l'appel est abandonné, l'élément est marqué en erreur, et le déploiement continue. Couvre aussi `getAllElements`, `getAllPagesAndFolders`, `switchPage`, `getName`/`getSlug`.
- **Logs de diagnostic** — Chaque écriture journalise `[deploy] → <méthode> (key/mode/type)` avant l'appel et `✓`/`✗` après. Le dernier `→` sans `✓` identifie l'appel et le type d'élément qui bloquent.

### Corrigé — API Webflow (mauvaises signatures)

- **Mode `link` cassé** — `setSettings` était appelé avec un objet (`{ email }`, `{ url, openInNewTab }`) au lieu de la signature réelle `setSettings(mode, target: string, metadata?)`. Email / téléphone / URL externe / chemin relatif étaient tous non fonctionnels. Corrigé (target string, `openInNewTab` en 3ᵉ argument).
- **Mode `prop:` retiré** — `setProperties` n'existe pas sur les éléments Designer (uniquement sur `Style`) ; le mode échouait systématiquement. Remplacé par un skip explicite documenté.
- **`getChildren()` non awaité** — La méthode est `async` (`Promise<Array>`) ; le fallback texte-enfant lisait `.length` sur une Promise et échouait toujours. Désormais awaité.
- **Placeholder via l'API Attributes** — `placeholder` est un attribut HTML standard, refusé par `setCustomAttribute` (« reserved attribute name »). Il est désormais posé via `setAttribute('placeholder', …)` (mixin Attributes, API ≥ 2.1), avec `setCustomAttribute` en dernier recours.

### Suite au test réel (site Agence immo, 9 pages)

Validé sur deux déploiements réels (rapports JSON) :

- **Nœuds `String` — corrigé** — Un `<div>` dont le texte est un enfant de type `String` (ex. `home.hero.cta1.button`) : les `String` exposent `setText()` et non `setTextContent()`. Ajout du fallback `setText` (sur l'élément et sur l'enfant). Vérifié : passe de `error` à `success`.
- **Placeholders & libellé de bouton submit — limite plateforme, désormais `skipped`** — Les attributs `placeholder` (champs de formulaire) et `value` (bouton submit) sont **réservés** par Webflow et rejetés par `setAttribute`, `setCustomAttribute` **et** `setSettings`. L'édition native des champs de formulaire est [sur la roadmap Webflow mais pas encore livrée](https://discourse.webflow.com/t/designer-api-roadmap-regarding-input-elements/273306) (réponse officielle Webflow, oct. 2024). Ces cas ne sont plus comptés comme **erreurs** mais comme **skips** avec un message explicite (« à définir manuellement dans le Designer »), pour ne pas alarmer. Le code tente quand même les setters (compatibilité future : ça marchera automatiquement quand Webflow l'exposera).

### Ajouté — UI

- **Compteur « Ignoré »** — 4ᵉ statistique dans l'écran de résultats (à côté de Appliqué / Échoué / Manquant), badge neutre + tooltip, pour distinguer clairement les éléments non applicables par limite Webflow (placeholders, libellés de bouton) des vraies erreurs. Badge « ignoré » aussi par page. `stats.skipped` ajouté au `DeploymentReport`.

### Corrigé — UI

- **Visibilité dark mode (résultats)** — Sur l'écran « Terminé avec des erreurs », le nom des pages **sans** erreur était quasi invisible (pas de couleur explicite → héritait du noir). Couleur forcée à `var(--text-primary)`.

### Corrigé — Déploiement & robustesse

- **Plusieurs éléments par clé** — `buildElementKeyMap` ne gardait qu'un élément par `data-wording-key` (régression) ; il indexe désormais une liste, et `applyChanges` applique la valeur à chaque élément partageant la clé.
- **Double comptage du rapport** — Chaque élément ne produit plus qu'une seule entrée.
- **Scan O(n²) supprimé** — Les attributs sont lus une seule fois ; résolution des pages factorisée (`resolveTargetPages`).
- **Clés SEO** — Détection sur le segment exact `_seo` (plus de faux positif type `pseudo_seo.x`).

### Corrigé — Parsing CSV

- **En-têtes avec espaces** — `transformHeader` trim les noms de colonnes ; extraction key/value factorisée et insensible à la casse/espaces.
- **Valeurs vides autorisées** — Une cellule `Data` vide vide désormais le contenu (aligné sur la voie JSON) au lieu d'être supprimée silencieusement.
- **Messages d'erreur** — En français, distinguant « colonnes manquantes » de « colonnes présentes mais aucune donnée ».

### Corrigé — UI / React / accessibilité

- **Erreur de chargement du site** — `App` affiche un écran d'erreur dédié + notification si `getSiteInfo()` échoue (au lieu d'un en-tête vide puis d'un message trompeur).
- **`ConfirmDialog`** — Noms accessibles (`aria-labelledby`/`aria-describedby` via `useId`), piège de focus (Tab) et restauration du focus à la fermeture.
- **Onglets CSV/JSON** — `<button role="tab">` focusables au clavier (au lieu de `<div onClick>`), avec `:focus-visible`.
- **Clés React stables** — `PreviewSection`, `ProgressSection`, `InputSection` n'utilisent plus l'index comme clé.
- **Divers** — `ProgressSection` calcule `currentIdx` une seule fois ; extension `.csv` insensible à la casse ; `processCSV` non-async ; JSDoc dupliqué retiré.

### Corrigé — Robustesse & hooks

- `useElementInspector` : accès null-safe aux attributs. `useConfirm` : la confirmation pendante est résolue avant la suivante. `useAppState` : `actions` mémoïsé. `useSiteInfo` : promesse flottante marquée `void`.

### Corrigé — Qualité & config

- **TypeScript durci** — `strictNullChecks`, `noImplicitAny`, `skipLibCheck`, `forceConsistentCasingInFileNames` activés ; script `npm run typecheck` ajouté.
- **`package.json`** — Version `1.6.1` ; `react`/`react-dom` déplacés en `dependencies` (doublon supprimé) ; config Babel + `babel-loader`/presets retirés (build via `ts-loader`).
- **Types/constantes** — `WordingMode` et `WORDING_MODES` réalignés sur le runtime réel (`text`/`link`/`placeholder`/`html` + `attr:*`/`prop:*`) ; `SEO_FIELDS` en union littérale.
- **Nettoyage** — Suppression du barrel `src/utils/index.ts` (orphelin), d'une variable morte et d'un `!important` superflu.

### Fichiers créés

- `src/utils/timeout.ts` — Helper `withTimeout(promise, label, timeoutMs)`.

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
