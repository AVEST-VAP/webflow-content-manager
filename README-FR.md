# Webflow Content Manager - Extension Webflow

Extension Webflow Designer pour déployer rapidement du wording sur vos sites à partir d'un fichier JSON.

## 🎯 Cas d'usage

Vous déployez plusieurs sites Webflow basés sur le même template, avec seulement le wording qui change ?
Cette extension vous permet de :
- Charger un JSON avec tout le wording d'un site
- Prévisualiser les changements
- Appliquer automatiquement les modifications sur les pages

## 📋 Prérequis

1. **Compte Webflow** avec accès au Designer
2. **Node.js** installé (v16+)
3. **Webflow CLI** installé (`npm install -g @webflow/webflow-cli`)

## 🚀 Installation & Lancement

### 1. Installer les dépendances

```bash
npm install
```

### 2. Lancer en mode développement

```bash
npm run dev
```

Cette commande va :
- Compiler l'extension
- Lancer le serveur de développement
- Vous donner une URL à ouvrir dans Webflow Designer

### 3. Ouvrir dans Webflow Designer

1. Ouvrez votre projet Webflow dans le Designer
2. Allez dans le menu Extensions
3. Cliquez sur "Add Extension" → "Development Extension"
4. Collez l'URL fournie par `npm run dev`

## 🎨 Configuration de votre Template Webflow

Pour que l'extension fonctionne, vous devez ajouter l'attribut `data-wording-key` sur les éléments que vous voulez modifier.

### Exemple dans Webflow Designer :

1. **Sélectionnez un élément de texte** (titre, paragraphe, etc.)
2. **Dans le panneau Settings** → **Custom Attributes**
3. **Ajoutez :**
   - Name: `data-wording-key`
   - Value: `home.hero.title` (par exemple)

### Convention de nommage des clés :

Utilisez la notation par points : `{page}.{section}.{element}`

**Exemples :**
```
home.hero.title
home.hero.subtitle
home.hero.cta_primary.text
sell.benefits.item_1.title
estimate.form.submit
```

## 📝 Format du JSON de Wording

### Structure minimale :

```json
{
  "site_id": "client-xyz",
  "version": "1.0.0",
  "content": {
    "home.hero.title": "Nouveau Titre",
    "home.hero.subtitle": "Sous-titre personnalisé",
    "home.cta.text": "Cliquez Ici"
  }
}
```

### Exemple complet :

Un fichier d'exemple est fourni : [`example-simple.json`](./example-simple.json)

```json
{
  "site_id": "client-demo",
  "version": "1.0.0",
  "content": {
    "home.hero.title": "Nouveau Titre de la Page"
  }
}
```

## 🔧 Utilisation

### 1️⃣ Charger le JSON

- Ouvrez l'extension dans le Designer
- Collez votre JSON dans la zone de texte
- Cliquez sur "Charger JSON"

### 2️⃣ Prévisualiser

- Cliquez sur "Prévisualiser les changements"
- L'extension scanne la page et affiche :
  - ✅ Éléments qui seront mis à jour
  - ⚠️ Clés manquantes dans le JSON
  - ⚠️ Clés JSON non utilisées sur la page

### 3️⃣ Appliquer

- Cliquez sur "Appliquer les changements"
- Confirmez
- L'extension met à jour tous les éléments
- Téléchargez le rapport de déploiement

## 📊 Rapport de Déploiement

Après chaque déploiement, vous pouvez télécharger un rapport JSON qui contient :

```json
{
  "deployment_id": "dep-1734620000000",
  "site_id": "client-xyz",
  "timestamp": "2025-12-19T15:30:00Z",
  "page_name": "Page courante",
  "changes": [
    {
      "key": "home.hero.title",
      "old_value": "Ancien Titre",
      "new_value": "Nouveau Titre",
      "status": "success"
    }
  ],
  "warnings": [],
  "errors": [],
  "stats": {
    "total_keys": 10,
    "applied": 8,
    "failed": 0,
    "missing": 2
  }
}
```

## 🏗️ Architecture du Projet

```
site-deployer/
├── public/
│   ├── index.html          # HTML de l'extension
│   └── styles.css          # Styles de base
├── src/
│   ├── index.tsx           # Interface React principale
│   ├── deployer.ts         # Logique de déploiement
│   └── types.ts            # Types TypeScript
├── webflow.json            # Config Webflow
├── package.json
└── README-FR.md
```

## 🔑 Fonctionnalités Clés

### ✅ Implémenté (v1.0)

- ✅ Upload de JSON manuel (copier/coller)
- ✅ Validation du schéma JSON
- ✅ Scan de la page pour `data-wording-key`
- ✅ Prévisualisation des changements
- ✅ Application des changements (texte uniquement)
- ✅ Rapport de déploiement téléchargeable
- ✅ Détection des clés manquantes/inutilisées

### 🚧 À venir (v2.0)

- ⏳ Support des liens (`href`)
- ⏳ Support des images (`src`)
- ⏳ Support HTML (`innerHTML`)
- ⏳ Fetch JSON depuis URL
- ⏳ Intégration Google Sheets
- ⏳ Mode "Appliquer à toutes les pages"

## 🐛 Dépannage

### L'extension ne se charge pas dans Webflow

- Vérifiez que `npm run dev` tourne bien
- Assurez-vous d'utiliser l'URL complète avec le port
- Essayez de rafraîchir le Designer

### Les éléments ne sont pas trouvés

- Vérifiez que `data-wording-key` est bien défini dans Custom Attributes
- La casse est importante : `home.hero.title` ≠ `Home.Hero.Title`
- Assurez-vous d'être sur la bonne page

### Les changements ne s'appliquent pas

- Certains éléments Webflow sont en lecture seule
- Les composants (symboles) peuvent avoir des limitations
- Vérifiez le rapport d'erreurs après application

## 📦 Build de Production

Pour créer un bundle de production :

```bash
npm run build
```

Cela génère un bundle optimisé dans `public/bundle.js`.

## 🤝 Workflow Recommandé

1. **Préparation Template** : Ajoutez tous les `data-wording-key` sur votre template master
2. **Export des Clés** : Documentez toutes les clés dans un fichier (Excel, Google Sheets)
3. **Génération JSON** : Pour chaque nouveau site, remplissez le wording et exportez en JSON
4. **Déploiement** : Ouvrez le template dupliqué, lancez l'extension, appliquez le JSON
5. **Vérification** : Parcourez les pages, vérifiez le wording
6. **Publish** : Publiez le site

## 📚 Ressources

- [Documentation Webflow Designer API](https://developers.webflow.com/designer/reference/introduction)
- [Documentation CLI Webflow](https://developers.webflow.com/designer/reference/webflow-cli)

## 📄 Licence

MIT

---

**Créé par votre équipe · Propulsé par Webflow Designer Extensions**
