# admi

Aplicación web estática para gestión de perfumes, con asistente IA en `asistente.html`.

## Asistente Gemini en GitHub Pages (seguro)

GitHub Pages **no ejecuta PHP**, por lo que `api/gemini_chat.php` debe desplegarse en un servicio backend (Cloud Run, Cloud Functions, Render, Railway, VPS con PHP, etc.).

### 1) Configura variables en tu servidor backend

- `GEMINI_API_KEY`
- `GEMINI_MODEL` (ej. `gemini-1.5-pro`)
- `ALLOWED_ORIGINS` (ej. `https://rodolfohubster.github.io`)

> `ALLOWED_ORIGINS` acepta múltiples orígenes separados por coma.

### 2) Configura el frontend

En `/home/runner/work/admi/admi/asistente.html` ajusta:

```html
<script>
  window.ASISTENTE_API_ENDPOINT = 'https://tu-api.com/api/gemini_chat.php';
</script>
```

> El valor por defecto en el repo está vacío para evitar errores de DNS con dominios de ejemplo.

### 3) Recomendaciones de seguridad

- Nunca pongas `GEMINI_API_KEY` en HTML/JS público.
- Restringe la key en Google Cloud a la API de Gemini.
- Rota la key periódicamente.
- Monitorea uso y cuotas.
- Mantén validación de origen + rate limit en backend.

## Desarrollo local

Este repositorio no incluye pipeline de build/test/lint definido por `package.json` o `composer.json`.
