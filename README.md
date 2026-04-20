# admi

Aplicación web estática para gestión de perfumes, con asistente IA en `asistente.html`.

## Despliegue del backend Gemini en Google Cloud Run

GitHub Pages **no ejecuta PHP**, por lo que `api/gemini_chat.php` debe correr en un backend (Cloud Run recomendado).

### 1) Proyecto y billing

1. Crea o selecciona un proyecto en Google Cloud.
2. Verifica que el proyecto tenga billing activo.

Puedes validarlo por CLI:

```bash
gcloud billing projects describe TU_PROJECT_ID
```

Reemplaza `TU_PROJECT_ID` por tu project id real o usa:

```bash
gcloud billing projects describe "$(gcloud config get-value project)"
```

### 2) Habilita APIs necesarias

En Google Cloud habilita:

- Cloud Run Admin API
- Cloud Build API
- Artifact Registry API
- Secret Manager API (opcional, recomendado)

También puedes hacerlo por CLI:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

### 3) Variables de entorno del backend

Configura en Cloud Run:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` (ej. `gemini-1.5-pro`)
- `ALLOWED_ORIGINS=https://rodolfohubster.github.io`

> `ALLOWED_ORIGINS` acepta múltiples orígenes separados por coma.

### 4) Despliega en Cloud Run

Este repositorio incluye `Dockerfile` para desplegar directamente:

```bash
gcloud run deploy admi-gemini-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_MODEL=gemini-1.5-pro,ALLOWED_ORIGINS=https://rodolfohubster.github.io \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

Si no usas Secret Manager, reemplaza `--set-secrets` por:

```bash
--set-env-vars GEMINI_API_KEY=TU_API_KEY,GEMINI_MODEL=gemini-1.5-pro,ALLOWED_ORIGINS=https://rodolfohubster.github.io
```

Al final tendrás una URL pública tipo:

`https://admi-gemini-api-xxxx-uc.a.run.app`

El endpoint final del asistente será:

`https://admi-gemini-api-xxxx-uc.a.run.app/api/gemini_chat.php`

> `xxxx` representa el sufijo único generado por Cloud Run; usa la URL real que te devuelve `gcloud run deploy`.

### 5) Configura el frontend

En `asistente.html` ajusta:

```html
<script>
  window.ASISTENTE_API_ENDPOINT = 'https://admi-gemini-api-xxxx-uc.a.run.app/api/gemini_chat.php';
</script>
```

> El valor por defecto en el repo está vacío para evitar errores de DNS con dominios de ejemplo.

### 6) Publica y prueba

Publica/actualiza GitHub Pages y valida:

- `https://rodolfohubster.github.io/admi/`
- `https://rodolfohubster.github.io/admi/asistente.html`

## Recomendaciones de seguridad

- Nunca pongas `GEMINI_API_KEY` en HTML/JS público.
- Restringe la key en Google Cloud a la API de Gemini.
- Rota la key periódicamente.
- Monitorea uso y cuotas.
- Mantén validación de origen + rate limit en backend.

## Desarrollo local

Este repositorio no incluye pipeline de build/test/lint definido por `package.json` o `composer.json`.
