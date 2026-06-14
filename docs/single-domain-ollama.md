# SIKA sur un seul domaine avec Ollama

Cette variante supprime la dependance a Railway, mais pas le besoin d'un serveur.
Un nom de domaine seul ne peut pas executer FastAPI ou Ollama. Il faut au minimum :

- un VPS ou une machine Linux
- le domaine `sika.oceanicconseils.com` pointe vers ce serveur
- Ollama tourne sur ce serveur

## Architecture

- frontend Vite servi par FastAPI
- API `/chat`, `/calculate`, `/market-data` servie par FastAPI
- moteur de conversation et d'analyse : Ollama
- meme origine pour le site et l'API

## Variables backend conseillees

```env
ENVIRONMENT=production
DEMO_MODE=false
SERVE_FRONTEND_FROM_BACKEND=true
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_KEEP_ALIVE=10m
ALLOWED_ORIGINS=https://sika.oceanicconseils.com,https://www.sika.oceanicconseils.com
TRUSTED_HOSTS=sika.oceanicconseils.com,www.sika.oceanicconseils.com,localhost,127.0.0.1
MARKET_DATA_PROVIDER=twelve-data
TWELVE_DATA_API_KEY=...
EXCHANGE_RATE_API_KEY=...
ALPHA_VANTAGE_API_KEY=...
```

## Frontend

Pour un deploiement sur le meme domaine, laisse `VITE_SIKA_API_BASE` vide.
Le frontend utilisera automatiquement `window.location.origin`.

## Docker

Le `Dockerfile` principal construit maintenant :

- le frontend `dist/`
- le backend Python

Tu peux lancer une pile locale de base avec :

```powershell
docker compose -f docker-compose.ollama.yml up --build
```

Puis charge un modele Ollama, par exemple :

```powershell
docker exec -it <container_ollama> ollama pull qwen3:8b
```

## Production conseillee

- Nginx ou Caddy devant FastAPI
- certificat TLS sur `sika.oceanicconseils.com`
- FastAPI ecoute en interne sur `127.0.0.1:8000`
- Ollama ecoute en interne sur `127.0.0.1:11434`

## Limite importante

Cette architecture supprime Railway, mais pas le cout machine.
Ollama demande plus de RAM et de CPU qu'un simple backend API.
