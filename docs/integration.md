# Integration SIKA sur `sika.oceanicconseils.com`

## 1. Backend

Expose l'API FastAPI sur un sous-domaine du type :

```text
https://sika-api.oceanicconseils.com
```

Variables minimales :

```env
DEMO_MODE=false
OPENAI_API_KEY=...
ALLOWED_ORIGINS=https://sika.oceanicconseils.com
```

Commandes :

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 2. Widget sur le site

Le backend sert deja les assets widget en public.

Exemple d'injection dans le layout global du site :

```html
<script
  src="https://sika-api.oceanicconseils.com/widget/sika-chatbot.js"
  data-default-language="fr"
  data-title="SIKA"
></script>
```

## 3. Page dediee `/assistant`

Le backend sert deja la page assistant sur :

```text
https://sika-api.oceanicconseils.com/assistant-app/
```

Sur Hostinger, le plus simple est de creer une page `assistant` puis d'y inserer un `iframe`.

## 4. Etapes recommandees

1. Lancer le MVP en `DEMO_MODE=true` pour valider le flux UI.
2. Activer `OPENAI_API_KEY` pour les vraies reponses.
3. Connecter MongoDB pour historiser les conversations.
4. Ajouter Redis pour le cache et le rate limiting distribue.
5. Brancher la voix en phase 2 sur les endpoints deja exposes.

## 5. Points de production

- activer HTTPS de bout en bout ;
- limiter les origines CORS au domaine de production ;
- brancher un vrai stockage de conversations avant l'ouverture publique ;
- remplacer le rate limiting memoire par Redis si plusieurs instances tournent ;
- monitorer latence, erreurs API et usage par langue.
