# Snippets Hostinger pour SIKA

## 1. Widget global sur tout le site

Colle ce code dans `Website settings > Integrations > Custom code` :

```html
<script
  src="https://sika-api.oceanicconseils.com/widget/sika-chatbot.js"
  data-title="SIKA"
  data-default-language="fr"
></script>
```

Le widget charge automatiquement son CSS depuis :

```text
https://sika-api.oceanicconseils.com/widget/sika-chatbot.css
```

## 2. Page `/assistant` dans Hostinger

Crée une page `assistant`, ajoute un bloc `Embed code`, puis colle :

```html
<iframe
  src="https://sika-api.oceanicconseils.com/assistant-app/"
  title="SIKA Assistant"
  loading="lazy"
  style="width:100%;min-height:100vh;border:0;border-radius:24px;overflow:hidden;background:#081321;"
  allow="microphone"
></iframe>
```

## 3. Si tu veux forcer l'API ou la langue

```html
<script>
  window.SIKA_API_BASE = "https://sika-api.oceanicconseils.com";
</script>
<script
  src="https://sika-api.oceanicconseils.com/widget/sika-chatbot.js"
  data-title="SIKA"
  data-default-language="fr"
></script>
```

## 4. Conditions minimales

- le backend FastAPI doit etre deploye sur `https://sika-api.oceanicconseils.com` ;
- `ALLOWED_ORIGINS` doit contenir `https://sika.oceanicconseils.com` ;
- si tu testes sur une URL de preview Hostinger, ajoute aussi cette URL temporaire.
