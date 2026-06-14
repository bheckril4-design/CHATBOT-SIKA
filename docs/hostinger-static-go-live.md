# Go Live Hostinger - version 100% statique

Objectif : publier SIKA sur `sika.oceanicconseils.com` avec uniquement des fichiers web statiques.

Cette version :
- ne depend pas de Railway
- ne depend pas d'un VPS
- ne depend pas d'une API backend pour le chat et les calculateurs
- fonctionne avec un simple build Vite + upload du contenu de `dist/`

## 1. Variables frontend

Verifier ces fichiers a la racine du projet :

- `.env.production`
- `.env.production.example`

Valeur attendue :

```env
VITE_SIKA_API_BASE=
```

Laisser cette variable vide pour forcer le mode autonome navigateur.

## 2. Build local

Depuis le dossier du projet :

```powershell
cd "C:\Users\hp\Desktop\CHATBOT SIKA"
cmd /c npm run build
```

Resultat attendu :
- un dossier `dist/`
- un fichier `dist/index.html`
- un dossier `dist/assets/`

## 3. Fichiers a uploader sur Hostinger

Dans Hostinger, ouvrir le dossier du sous-domaine :

```text
public_html/sika
```

Supprimer ou archiver l'ancien contenu web inutile, puis envoyer :

- tout le contenu de `dist/`
- pas le dossier `dist` lui-meme, seulement son contenu

Le dossier final sur Hostinger doit ressembler a ceci :

```text
public_html/sika/
  index.html
  assets/
  .htaccess
```

Si `.htaccess` existe deja et gere bien les routes SPA, le conserver.

## 4. Regle SPA minimale

Si besoin, mettre ce `.htaccess` dans `public_html/sika/.htaccess` :

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /sika/index.html [L]
```

Adaptez seulement le chemin final si votre sous-domaine pointe vers un autre dossier.

## 5. DNS

Pour cette version statique simple :

- `sika.oceanicconseils.com` doit pointer vers l'hebergement Hostinger
- aucun sous-domaine `api.*` n'est requis
- aucun enregistrement Railway n'est requis

## 6. Verification apres upload

Tester :

- `https://sika.oceanicconseils.com`
- `https://sika.oceanicconseils.com/assistant`
- la section calculateurs
- le chatbot principal

Comportement attendu :

- le chat repond sans erreur reseau
- les calculateurs ne montrent plus `Failed to fetch`
- aucune dependance a `sika-api.*`

## 7. Widget simple

Si vous utilisez le widget embarque, utilisez de preference le script sans `data-api-base` :

```html
<script
  src="https://sika.oceanicconseils.com/widget/sika-chatbot.js"
  data-title="SIKA"
  data-default-language="fr"
></script>
```

Ainsi, le widget reste en mode autonome sur le domaine.

## 8. Ce qu'il ne faut plus faire pour cette version

Ne pas :

- renseigner `VITE_SIKA_API_BASE` avec `https://sika-api.oceanicconseils.com`
- dependre de Railway pour le chat
- attendre un endpoint `/health` ou `/readiness`
- uploader autre chose que le contenu de `dist/` pour le frontend

## 9. Evolution future

Quand vous voudrez remettre une vraie IA distante :

- ajouter un backend separe
- remettre `VITE_SIKA_API_BASE` vers cette API
- rebuilder le frontend

En attendant, cette version est la plus simple a maintenir et la plus facile a publier.
