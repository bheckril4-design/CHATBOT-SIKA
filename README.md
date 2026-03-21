# SIKA MVP

Socle technique pour lancer le MVP de SIKA avec :

- une API FastAPI pour le chat et les calculs financiers ;
- un widget JavaScript intégrable sur `sika.oceanicconseils.com` ;
- une page dédiée `/assistant` prête à être servie comme page statique.

## Structure

```text
backend/
  app/
  .env.example
  requirements.txt
frontend/
  widget/
  assistant/
docs/
tests/
```

## Démarrage rapide

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

L'API démarre par défaut sur `http://127.0.0.1:8000`.

## Variables importantes

- `DEMO_MODE=true` permet de lancer SIKA sans clé OpenAI.
- `OPENAI_API_KEY` active les réponses IA réelles.
- `ALLOWED_ORIGINS` doit contenir le domaine de production.
- `backend/.env.production.example` donne la base prête pour la prod.

## Intégration du widget

Le backend expose directement les assets publics sur `/widget/`. Pour Hostinger, ajoute :

```html
<script
  src="https://sika-api.oceanicconseils.com/widget/sika-chatbot.js"
  data-default-language="fr"
  data-title="SIKA"
></script>
```

Le script charge automatiquement `sika-chatbot.css` depuis le même dossier.

## Assistant plein écran

Le backend sert aussi l'interface dédiée sur :

```text
https://sika-api.oceanicconseils.com/assistant-app/
```

Tu peux donc l'afficher dans Hostinger avec un `iframe`.

Adapte au besoin :

- l'URL de l'API dans `assistant.js` ;
- le branding si nécessaire ;
- l'authentification si vous ajoutez des comptes utilisateurs.

## Endpoints disponibles

- `GET /health`
- `POST /chat`
- `POST /calculate`
- `GET /market-data`
- `POST /voice-to-text`
- `POST /text-to-speech`

## Notes MVP

- La voix et les providers financiers externes sont scaffoldés avec fallback démo.
- Le focus immédiat reste le chat texte FR, conformément à la recommandation du cahier des charges.
- Le code est prêt à être étendu vers Redis, MongoDB et du streaming.
