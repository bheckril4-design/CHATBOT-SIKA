# Deploiement Hostinger sur sika.oceanicconseils.com

## Architecture recommandee

- frontend React/Vite sur `https://sika.oceanicconseils.com`
- backend FastAPI sur `https://sika-api.oceanicconseils.com`

## Frontend

1. Mettre dans le frontend :

```env
VITE_SIKA_API_BASE=https://sika-api.oceanicconseils.com
```

2. Generer le build :

```bash
cmd /c npm install
cmd /c npm run build
```

3. Publier le contenu de `dist/` dans la racine web du sous-domaine `sika.oceanicconseils.com`.

## Backend

Configurer le serveur API avec :

```env
ENVIRONMENT=production
DEMO_MODE=false
ALLOWED_ORIGINS=https://sika.oceanicconseils.com,https://www.sika.oceanicconseils.com
TRUSTED_HOSTS=sika-api.oceanicconseils.com
```

Puis deployer FastAPI sur le sous-domaine `sika-api.oceanicconseils.com`.

## Verification

1. `https://sika.oceanicconseils.com/` charge.
2. `https://sika.oceanicconseils.com/assistant` charge.
3. `https://sika-api.oceanicconseils.com/health` repond `{"status":"ok"}`.
4. `https://sika-api.oceanicconseils.com/readiness` repond.
5. Le chatbot et les calculateurs repondent depuis le frontend.
