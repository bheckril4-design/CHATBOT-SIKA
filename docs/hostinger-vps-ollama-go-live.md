# Checklist de déploiement SIKA sur un seul domaine avec Ollama

Objectif :

- plus de Railway
- un seul domaine public : `sika.oceanicconseils.com`
- frontend + API servis par FastAPI
- Ollama sur le meme serveur

Point important :

- un nom de domaine seul ne suffit pas
- il faut un VPS ou une machine Linux capable d'executer Docker, FastAPI et Ollama

## 1. Prerequis

- un VPS Ubuntu 24.04 LTS ou 22.04 LTS
- acces SSH au serveur
- le domaine `oceanicconseils.com` reste gere par Cloudflare
- un sous-domaine `sika` libre dans Cloudflare
- au moins 8 Go de RAM si tu veux un modele Ollama confortable comme `qwen3:8b`

## 2. DNS Cloudflare

Dans Cloudflare > DNS, cree ou corrige :

- Type : `A`
- Name : `sika`
- IPv4 address : `IP_PUBLIQUE_DU_VPS`
- Proxy status : `DNS only` pour le premier test

Supprime les anciens records conflictuels pour `sika` si besoin.

Resultat attendu :

- `sika.oceanicconseils.com` pointe vers le VPS

## 3. Installer Docker sur le VPS

Sur le serveur :

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Reconnecte-toi ensuite en SSH.

## 4. Recuperer le code

Sur le VPS :

```bash
git clone https://github.com/bheckril4-design/CHATBOT-SIKA.git
cd CHATBOT-SIKA
```

Si le repo existe deja :

```bash
cd CHATBOT-SIKA
git pull
```

## 5. Configurer le frontend en same-domain

Le projet est deja prepare pour ca :

- `.env.production` laisse `VITE_SIKA_API_BASE` vide
- FastAPI peut servir `dist/` si `SERVE_FRONTEND_FROM_BACKEND=true`

Build frontend :

```bash
npm ci
npm run build
```

## 6. Configurer le backend

Creer `backend/.env` sur le VPS :

```env
APP_NAME=SIKA API
APP_VERSION=1.0.0
ENVIRONMENT=production
DEMO_MODE=false
ALLOWED_ORIGINS=https://sika.oceanicconseils.com,https://www.sika.oceanicconseils.com
TRUSTED_HOSTS=sika.oceanicconseils.com,www.sika.oceanicconseils.com,localhost,127.0.0.1
SERVE_FRONTEND_FROM_BACKEND=true
AI_PROVIDER=ollama
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.2
OPENAI_REASONING_EFFORT=medium
OPENAI_TEXT_VERBOSITY=medium
OPENAI_TEMPERATURE=0.2
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_KEEP_ALIVE=10m
MAX_HISTORY_MESSAGES=16
RATE_LIMIT_PER_MINUTE=60
MARKET_DATA_PROVIDER=twelve-data
TWELVE_DATA_API_KEY=...
ALPHA_VANTAGE_API_KEY=...
EXCHANGE_RATE_API_KEY=...
```

Notes :

- `AI_PROVIDER=ollama` active le chat local
- `SERVE_FRONTEND_FROM_BACKEND=true` sert le site depuis FastAPI
- si tu veux rester sans LLM pour un temps, mets `DEMO_MODE=true`

## 7. Demarrer Ollama

Option simple sans Docker pour Ollama :

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
```

Puis dans un autre shell :

```bash
ollama pull qwen3:8b
```

Option Docker compose :

```bash
docker compose -f docker-compose.ollama.yml up -d --build
docker exec -it $(docker ps --format '{{.Names}}' | grep ollama) ollama pull qwen3:8b
```

## 8. Lancer SIKA

Si tu utilises le `Dockerfile` principal :

```bash
docker build -t sika-app .
docker run -d \
  --name sika-app \
  --restart unless-stopped \
  --env-file backend/.env \
  -p 8000:8000 \
  sika-app
```

Si tu utilises `docker-compose.ollama.yml`, prefere :

```bash
docker compose -f docker-compose.ollama.yml up -d --build
```

## 9. Reverse proxy et HTTPS

Le plus propre est de mettre Nginx ou Caddy devant l'app.

Exemple Nginx minimal :

```nginx
server {
    listen 80;
    server_name sika.oceanicconseils.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Puis active SSL avec Let's Encrypt ou Cloudflare selon ton setup.

## 10. Tests finaux

Depuis le navigateur :

- `https://sika.oceanicconseils.com`
- `https://sika.oceanicconseils.com/assistant`
- `https://sika.oceanicconseils.com/health`
- `https://sika.oceanicconseils.com/readiness`

Resultats attendus :

- `/health` -> `{"status":"ok"}`
- `/readiness` -> `status=ready`
- `chat_mode=ollama`

Test marche :

- `https://sika.oceanicconseils.com/market-data?symbol=BTC/USD&asset_type=crypto&base_currency=BTC&quote_currency=USD`
- `https://sika.oceanicconseils.com/market-data?symbol=XOF/EUR&asset_type=forex&base_currency=XOF&quote_currency=EUR`

## 11. Checklist rapide

- DNS `sika` pointe vers le VPS
- frontend build present dans `dist/`
- `backend/.env` configure
- Ollama actif
- modele Ollama telecharge
- conteneur FastAPI actif
- proxy HTTP/HTTPS actif
- `/health` et `/readiness` OK

## 12. Ce que cette architecture supprime

- plus besoin de Railway
- plus besoin de `sika-api.oceanicconseils.com`
- plus besoin de CORS inter-domaines complexes si tout est servi par `sika.oceanicconseils.com`
