# Go-Live Final - SIKA

## 1. Configuration production recommandee

Cas cible recommande:

- frontend sur `https://sika.oceanicconseils.com`
- backend API sur `https://sika-api.oceanicconseils.com`

Fichier:

```text
backend/.env.production.example
```

Valeurs recommandees:

```env
APP_NAME=SIKA API
APP_VERSION=1.0.0
ENVIRONMENT=production
DEMO_MODE=false
ALLOWED_ORIGINS=https://sika.oceanicconseils.com,https://www.sika.oceanicconseils.com
TRUSTED_HOSTS=sika-api.oceanicconseils.com
OPENAI_API_KEY=sk-your-real-openai-key
OPENAI_MODEL=gpt-5.2
OPENAI_REASONING_EFFORT=none
OPENAI_TEXT_VERBOSITY=medium
OPENAI_TEMPERATURE=0.2
MAX_HISTORY_MESSAGES=16
RATE_LIMIT_PER_MINUTE=60
MARKET_DATA_PROVIDER=twelve-data
TWELVE_DATA_API_KEY=td-your-real-twelve-data-key
ALPHA_VANTAGE_API_KEY=
EXCHANGE_RATE_API_KEY=er-your-real-exchange-rate-key
```

Notes:

- si tu ne sers pas `www`, retire simplement `https://www.sika.oceanicconseils.com`;
- si tu sers aussi l'API sur `www` ou un autre host public, ajoute-le explicitement a `TRUSTED_HOSTS`;
- si tu veux reduire le cout IA, remplace `OPENAI_MODEL=gpt-5.2` par `OPENAI_MODEL=gpt-5-mini`;
- la voix reste en placeholder dans ce MVP, donc elle ne doit pas entrer dans la definition de "pret prod".

## 2. Reverse proxy / routage

Le frontend React doit servir:

- `/`
- `/assistant`
- toutes les routes SPA vers `index.html`

Le backend FastAPI doit servir:

- `/chat`
- `/calculate`
- `/market-data`
- `/voice-to-text`
- `/text-to-speech`
- `/health`
- `/readiness`
- `/widget/*`
- `/assistant-app/*`

## 3. Checklist exacte avant mise en ligne

1. Copier le contenu de `backend/.env.production.example` dans le vrai `.env` du serveur.
2. Remplacer toutes les valeurs placeholder par les vraies cles.
3. Verifier que `DEMO_MODE=false`.
4. Verifier que `OPENAI_API_KEY` est present.
5. Verifier que `ALLOWED_ORIGINS` contient exactement les domaines publics reels.
6. Verifier que `TRUSTED_HOSTS` contient exactement les hosts publics reels.
7. Build frontend:

```bash
cmd /c npm install
cmd /c npm run build
```

8. Publier le contenu de `dist/` sur l'hebergement web de `sika.oceanicconseils.com`.
9. Mettre `VITE_SIKA_API_BASE=https://sika-api.oceanicconseils.com` dans le frontend avant le build.
10. Redemarrer FastAPI avec le `.env` production sur `sika-api.oceanicconseils.com`.
11. Tester `GET /health`.
12. Tester `GET /readiness`.
13. Tester un vrai `POST /chat`.
14. Tester un vrai `POST /calculate`.
15. Verifier la page `/assistant`.
16. Verifier le widget flottant sur la page d'accueil.
17. Tester une conversation de plus de 5 messages pour confirmer la memoire recente.
18. Verifier les logs serveur sur une session reelle.

## 4. Commandes de verification minimales

Depuis le serveur ou via curl:

```bash
curl https://sika-api.oceanicconseils.com/health
curl https://sika-api.oceanicconseils.com/readiness
```

Exemple de test chat:

```bash
curl -X POST https://sika-api.oceanicconseils.com/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"J'ai 40000 a investir sur 4 ans\",\"language\":\"fr\",\"history\":[]}"
```

Exemple de test calcul:

```bash
curl -X POST https://sika-api.oceanicconseils.com/calculate ^
  -H "Content-Type: application/json" ^
  -d "{\"type\":\"compound-savings\",\"principal\":40000,\"annual_rate\":5,\"duration_months\":48,\"contribution\":0,\"periods_per_year\":12}"
```

## 5. Critere go / no-go

Go:

- `/readiness` retourne `status=ready`;
- `chat_ready=true`;
- `cors_ready=true`;
- `trusted_hosts_ready=true`;
- le widget et `/assistant` repondent;
- les tests fonctionnels manuels sont bons.

No-go:

- `DEMO_MODE=true` en prod;
- absence de `OPENAI_API_KEY`;
- `ALLOWED_ORIGINS` ou `TRUSTED_HOSTS` incomplets;
- erreurs 429 trop agressives sur usage normal;
- `finance_provider_demo` si tu promets des donnees de marche reelles;
- endpoints voice presentes comme "actifs" alors qu'ils sont encore placeholder.

## 6. Limites restantes a assumer

- le module voix est encore MVP placeholder;
- les donnees finance restent dependantes des cles providers externes;
- le rate limit est en memoire locale, pas distribue;
- il n'y a pas encore de persistance de conversation cote backend.
