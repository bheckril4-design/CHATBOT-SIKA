# Redeploiement du site SIKA

## Vue d'ensemble

Le projet se redeploie maintenant comme une application React + un backend FastAPI.

- le frontend React gere la page `/`, la page `/assistant` et le chatbot flottant ;
- le backend FastAPI gere `/chat`, les endpoints metier et la mini app embarquee sur `/assistant-app/`.
- l'architecture recommandee en production est :
  - frontend sur `https://sika.oceanicconseils.com`
  - backend sur `https://sika-api.oceanicconseils.com`

## 1. Frontend

Pour le cas recommande, cree un fichier `.env.production` ou `.env` a la racine avec :

```env
VITE_SIKA_API_BASE=https://sika-api.oceanicconseils.com
```

Build :

```bash
cmd /c npm install
cmd /c npm run build
```

Publie ensuite le contenu genere par Vite dans la racine web du domaine.

Le fichier `public/.htaccess` permet a Apache de renvoyer `/assistant` vers `index.html` pour que React Router fonctionne.

## 2. Backend

Le backend doit exposer au minimum :

- `POST /chat`
- `GET /health`
- `GET /market-data`
- `POST /calculate`
- `POST /voice-to-text`
- `POST /text-to-speech`
- `GET /assistant-app/`

Le modele de configuration production est dans :

```text
backend/.env.production.example
```

Valeurs cibles :

```env
ALLOWED_ORIGINS=https://sika.oceanicconseils.com,https://www.sika.oceanicconseils.com
TRUSTED_HOSTS=sika-api.oceanicconseils.com
```

## 3. Cas meme domaine

Si tu veux que tout reste sous `https://sika.oceanicconseils.com`, il faut que ton reverse proxy envoie :

- les routes du frontend vers le build React ;
- les routes `/chat`, `/market-data`, `/calculate`, `/voice-to-text`, `/text-to-speech`, `/health` et `/assistant-app/` vers FastAPI.

## 4. Verifications apres mise en ligne

1. `https://sika.oceanicconseils.com/` charge bien.
2. Le bouton SIKA apparait en bas a droite.
3. `https://sika.oceanicconseils.com/assistant` charge bien.
4. `https://sika-api.oceanicconseils.com/health` repond `{"status":"ok"}`.
5. Un message envoye dans le chatbot recoit une reponse.
