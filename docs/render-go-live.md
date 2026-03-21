# Go Live Frontend Hostinger + Backend Render

## 1. Frontend

Le frontend est deja prepare pour la production avec :

```env
VITE_SIKA_API_BASE=https://sika-api.oceanicconseils.com
```

Build :

```bash
cmd /c npm install
cmd /c npm run build
```

Publier ensuite le contenu de `dist/` sur `sika.oceanicconseils.com`.

## 2. Backend Render

Sur Render, creer un nouveau `Web Service` depuis le repository.

Utiliser ces valeurs :

- Root Directory : `backend`
- Runtime : `Docker`
- Dockerfile Path : `Dockerfile`
- Docker Build Context Directory : `.`

Note :

- quand `Root Directory` vaut `backend`, Render interprete `Dockerfile Path` et `Docker Build Context Directory`
  relativement a ce dossier ;
- l'interface peut afficher un prefixe visuel `backend/` automatiquement, ce qui est normal.

Variables d'environnement a definir :

```env
APP_NAME=SIKA API
APP_VERSION=1.0.0
ENVIRONMENT=production
DEMO_MODE=false
ALLOWED_ORIGINS=https://sika.oceanicconseils.com,https://www.sika.oceanicconseils.com
TRUSTED_HOSTS=sika-api.oceanicconseils.com,*.onrender.com
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.2
OPENAI_REASONING_EFFORT=none
OPENAI_TEXT_VERBOSITY=medium
OPENAI_TEMPERATURE=0.2
MAX_HISTORY_MESSAGES=16
RATE_LIMIT_PER_MINUTE=60
MARKET_DATA_PROVIDER=twelve-data
TWELVE_DATA_API_KEY=td-...
ALPHA_VANTAGE_API_KEY=
EXCHANGE_RATE_API_KEY=er-...
```

Health Check Path :

```text
/health
```

## 3. Domaine personnalise

Ajouter le custom domain `sika-api.oceanicconseils.com` dans Render.

Ensuite, dans Hostinger DNS :

- si Render te donne une cible DNS, cree un `CNAME` sur `sika-api`
- si tu deployes sur un VPS avec IP fixe, cree un `A record` sur `sika-api`

Quand le custom domain est verifie et que le service repond bien, tu peux resserrer `TRUSTED_HOSTS`
en remplacant `*.onrender.com` par l'hostname Render exact du service si tu veux un verrouillage plus strict.

## 4. Verification

```bash
curl https://sika-api.oceanicconseils.com/health
curl https://sika-api.oceanicconseils.com/readiness
```

Le frontend doit ensuite repondre via :

- `https://sika.oceanicconseils.com`
- `https://sika.oceanicconseils.com/assistant`
