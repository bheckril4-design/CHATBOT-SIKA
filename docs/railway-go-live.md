# Go Live Frontend Hostinger + Backend Railway

## Architecture

- frontend React/Vite sur `https://sika.oceanicconseils.com`
- backend FastAPI sur `https://sika-api.oceanicconseils.com`

## Frontend

Le frontend est deja configure avec :

```env
VITE_SIKA_API_BASE=https://sika-api.oceanicconseils.com
```

Publier le contenu de `dist/` sur `sika.oceanicconseils.com`.

## Backend Railway

Creer un nouveau projet Railway depuis le repository GitHub.

Le repository contient maintenant :

- un `Dockerfile` a la racine pour Railway ;
- un `railway.toml` a la racine pour forcer le builder Dockerfile et `/health`.

Tu peux donc deployer depuis la racine du repository sans configuration monorepo speciale.

Variables d'environnement a definir :

```env
APP_NAME=SIKA API
APP_VERSION=1.0.0
ENVIRONMENT=production
DEMO_MODE=false
PORT=8000
ALLOWED_ORIGINS=https://sika.oceanicconseils.com,https://www.sika.oceanicconseils.com
TRUSTED_HOSTS=sika-api.oceanicconseils.com,*.up.railway.app
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.2
OPENAI_REASONING_EFFORT=none
OPENAI_TEXT_VERBOSITY=medium
OPENAI_TEMPERATURE=0.2
MAX_HISTORY_MESSAGES=16
RATE_LIMIT_PER_MINUTE=60
MARKET_DATA_PROVIDER=demo
TWELVE_DATA_API_KEY=
ALPHA_VANTAGE_API_KEY=
EXCHANGE_RATE_API_KEY=
```

Important :

- Railway injecte normalement une variable `PORT` pour ses healthchecks ;
- comme le domaine public a ete cree avec un target port `8000`, definir `PORT=8000`
  evite les desalignements entre le port ecoute par l'app, le healthcheck et le domaine public.

## Domaine personnalise

Dans Railway :

1. Generer d'abord un domaine Railway en `*.up.railway.app`
2. Ajouter ensuite le custom domain `sika-api.oceanicconseils.com`
3. Railway fournira la cible CNAME a mettre dans Hostinger DNS

Dans Hostinger DNS :

- Type : `CNAME`
- Host : `sika-api`
- Points to : la cible Railway `*.up.railway.app`

## Verification

```bash
curl https://sika-api.oceanicconseils.com/health
curl https://sika-api.oceanicconseils.com/readiness
```
