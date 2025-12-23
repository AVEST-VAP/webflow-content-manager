# Webflow Content Manager - Guide de Démarrage Rapide - Site Deployer

## Prochaines Étapes

### 1️⃣ Lancer l'Extension en Mode Développement

```bash
cd /Users/fawsy/Avest/site-deployer
npm run dev
```

Cette commande va :
- Compiler votre extension React
- Lancer un serveur de développement
- Vous donner une **URL locale** (ex: `http://localhost:1337`)

**⚠️ Gardez ce terminal ouvert pendant que vous travaillez !**

---

### 2️⃣ Ouvrir l'Extension dans Webflow Designer

1. **Ouvrez votre projet Webflow** dans le Designer (https://webflow.com/design/)

2. **Allez dans le panneau Extensions** (icône puzzle en haut à droite)

3. **Cliquez sur "Add Extension"** → **"Development Extension"**

4. **Collez l'URL** donnée par `npm run dev` (ex: `http://localhost:1337`)

5. **L'extension s'ouvre** dans un panneau latéral du Designer !

---

### 3️⃣ Préparer Votre Page de Test

#### Sur une page Webflow (par exemple la Home) :

1. **Sélectionnez un titre** (H1, H2, etc.)

2. **Dans le panneau Settings** (à droite) → **Descendez jusqu'à "Custom Attributes"**

3. **Cliquez sur "+"** pour ajouter un attribut

4. **Remplissez :**
   - **Name:** `data-wording-key`
   - **Value:** `home.hero.title`

5. **Enregistrez** (Enter)

#### Répétez pour d'autres éléments :

| Élément | data-wording-key |
|---------|------------------|
| Titre principal | `home.hero.title` |
| Sous-titre | `home.hero.subtitle` |
| Bouton CTA | `home.hero.cta` |

---

### 4️⃣ Tester l'Extension

#### Dans le panneau de l'extension :

1. **Collez ce JSON de test** dans la zone de texte :

```json
{
  "site_id": "test-demo",
  "version": "1.0.0",
  "content": {
    "home.hero.title": "Mon Nouveau Titre !"
  }
}
```

2. **Cliquez sur "Charger JSON"** ✅

3. **Cliquez sur "Prévisualiser les changements"** 👀
   - Vous devriez voir : "1 élément avec valeur"

4. **Cliquez sur "Appliquer les changements"** 🚀

5. **Confirmez** dans la popup

6. **Votre titre devrait changer** dans le Designer !

7. **Téléchargez le rapport** si vous voulez voir les détails

---

## 🎯 Cas d'Usage Réel : Déployer un Nouveau Site

### Workflow Complet

#### **Étape 1 : Préparer le Template Master**

Sur votre template Webflow de base :

1. Ajoutez `data-wording-key` sur **tous les éléments de texte** que vous voulez personnaliser par site
2. Documentez toutes les clés dans un fichier Excel/Google Sheets
3. Exportez le template (ou dupliquez-le)

**Exemple de clés pour une page Home :**
```
home.hero.title
home.hero.subtitle
home.hero.cta_primary.text
home.benefits.title
home.benefits.item_1.title
home.benefits.item_1.description
home.benefits.item_2.title
home.benefits.item_2.description
```

#### **Étape 2 : Créer le JSON pour un Nouveau Site**

Dans votre Google Sheet, créez une ligne par site :

| Clé | Site Paris | Site Lyon | Site Marseille |
|-----|-----------|-----------|----------------|
| home.hero.title | Vendez à Paris | Vendez à Lyon | Vendez à Marseille |
| home.hero.subtitle | Offre en 24h | Offre rapide | Vente express |
| ... | ... | ... | ... |

Exportez chaque colonne en JSON :

```json
{
  "site_id": "site-paris",
  "version": "1.0.0",
  "content": {
    "home.hero.title": "Vendez à Paris",
    "home.hero.subtitle": "Offre en 24h",
    ...
  }
}
```

#### **Étape 3 : Déployer**

1. Dupliquez le template Webflow
2. Renommez le projet (ex: "Site Paris")
3. Ouvrez dans le Designer
4. Lancez l'extension (`npm run dev`)
5. Collez le JSON "site-paris"
6. Prévisualisez → Appliquez
7. Vérifiez visuellement
8. Publiez !

---

## 📋 Checklist de Déploiement

- [ ] Template master prêt avec tous les `data-wording-key`
- [ ] Google Sheet avec tous les wordings par site
- [ ] JSON exporté et validé
- [ ] Extension lancée (`npm run dev`)
- [ ] Site dupliqué dans Webflow
- [ ] JSON chargé et prévisualisé
- [ ] Changements appliqués avec succès
- [ ] Rapport téléchargé et archivé
- [ ] Vérification visuelle page par page
- [ ] Site publié

---

## 🔧 Commandes Utiles

```bash
# Lancer en mode dev (watch + serveur)
npm run dev

# Compiler uniquement
npm run build-webpack

# Créer un bundle de production
npm run build

# Linter le code
npm run lint
```

---

## 🐛 Problèmes Courants

### L'extension ne se charge pas
- ✅ Vérifiez que `npm run dev` tourne
- ✅ Utilisez l'URL complète (avec http://)
- ✅ Désactivez les bloqueurs de pub si nécessaire

#### 🔗 Gérer les Liens (Nouveauté)

Vous pouvez modifier la destination d'un bouton ou d'un lien.

**Dans votre tableau (CSV) :**
| Key | Data |
|-----|------|
| `home.cta` | `Voir le prix` (Texte du bouton) |
| `home.cta_link` | `https://exemple.com` (Lien) |
| `home.page_interne` | `Nos Agences` (Lien vers page interne) |

**Dans Webflow :**
1.  Sélectionnez l'élément (Link Block ou Button).
2.  Ajoutez `data-wording-key="home.cta_link"`.
3.  Ajoutez `data-wording-mode="link"`.

> **Important - Boutons Natifs vs Link Blocks :**
> L'élément "Button" natif de Webflow ne permet pas de modifier son texte via l'API.
> Si vous voulez modifier le TEXTE d'un bouton, utilisez une structure : **Link Block** (pour le lien) + **Text Block** (pour le texte) à l'intérieur.
> - Sur le Link Block : `data-wording-key="...link"` et `data-wording-mode="link"`
> - Sur le Text Block : `data-wording-key="...text"` (sans mode)

> **Note :** Si vous mettez une URL (`https://...`), ça crée un lien externe. Si vous mettez un nom de page (ex: `Nos Agences`), ça crée un lien interne intelligent.

#### 🧩 Gérer les Composants (Avancé)

Si vous utilisez des composants avec des propriétés (ex: "Text", "Link") :

**Dans Webflow :**
1.  Sélectionnez l'instance du composant.
2.  Ajoutez `data-wording-key="home.mon_composant"`.
3.  Ajoutez `data-wording-mode="prop:LeNomDeLaPropriete"` (ex: `prop:Text`).

### Les éléments ne sont pas trouvés
- ✅ Vérifiez l'orthographie de `data-wording-key`
- ✅ Assurez-vous d'être sur la bonne page
- ✅ Les clés sont case-sensitive !

### Les changements ne s'appliquent pas
- ✅ Certains éléments Webflow sont en lecture seule
- ✅ Essayez sur un élément de texte simple d'abord
- ✅ Vérifiez le rapport d'erreurs

---

## 📚 Ressources

- [README Complet](./README-FR.md)
- [Exemple JSON Simple](./example-simple.json)
- [Documentation Webflow Designer API](https://developers.webflow.com/designer/reference/introduction)

---

**Prêt à déployer des sites à la vitesse de l'éclair ! ⚡**
