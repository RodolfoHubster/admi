# admi

Aplicación web estática para gestión de perfumes, con asistente IA en `asistente.html`.

## Reinicio limpio de Gemini (desde cero)

Objetivo: usar **solo** backend `api/gemini_chat.php` para Gemini, sin exponer `GEMINI_API_KEY` en frontend.

### 1) Variables base

Copia `.env.example` a `.env` y completa:

- Backend Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL`, `ALLOWED_ORIGINS`.
- Front runtime: `ASISTENTE_API_ENDPOINT` (y opcional `ASISTENTE_API_HEALTH_ENDPOINT`).
- Tipo de cambio: `EXCHANGE_API_*` si aplica.

### 2) Backend Gemini en Cloud Run

GitHub Pages **no ejecuta PHP**, por lo que `api/gemini_chat.php` debe correr en backend (Cloud Run recomendado).

Habilita servicios:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

Despliega:

```bash
gcloud run deploy admi-gemini-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_MODEL=gemini-1.5-flash,ALLOWED_ORIGINS=https://rodolfohubster.github.io \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

### 3) Frontend apuntando solo al backend

Configura el runtime del frontend con el endpoint público del backend:

```bash
--set-env-vars ASISTENTE_API_ENDPOINT=https://admi-gemini-api-PROJECT-HASH-uc.a.run.app/api/gemini_chat.php,EXCHANGE_API_ENDPOINT=https://api.exchangerate-api.com/v4/latest/USD
```

`docker-entrypoint.sh` inyecta esas variables a `assets/js/runtime-config.js` como `window.__APP_ENV__`.

## Validación rápida

### Health check asistente

`GET /api/gemini_chat.php?health=1` debe devolver `status: ok`.

### Flujo funcional en UI

1. Abrir `asistente.html`.
2. Enviar mensaje sin imagen.
3. Enviar mensaje con imagen JPG/PNG válida.
4. Verificar respuesta y manejo de errores 401/403/429/5xx.

### Seguridad mínima

- `GEMINI_API_KEY` solo en backend/secret manager.
- `ALLOWED_ORIGINS` correcto para el dominio del frontend.
- Rate limit activo en backend.
- Revisar logs: `gemini_assistant.log`, `gemini_assistant_security.log`, `gemini_assistant_error.log`.

## Control de acceso por roles (frontend)

Se añadió sesión con roles para operación diaria:

- `admin`: acceso total (edición, borrado, respaldos).
- `vendedor`: venta/cobranza sin borrados sensibles.
- `readonly`: solo consulta.

La sesión se guarda en `sessionStorage` (`fito_session`) y usa versión global (`fito_session_version`) para cierre de sesión global.

> Importante: cambia los hashes/PINs por defecto definidos en `login.html` antes de usar en producción.

## Checklist post-pull (copiar/pegar)

- [ ] `.env` creado desde `.env.example`.
- [ ] `GEMINI_API_KEY` cargada por secret en Cloud Run.
- [ ] `GEMINI_MODEL` y `ALLOWED_ORIGINS` configurados.
- [ ] `ASISTENTE_API_ENDPOINT` actualizado al backend desplegado.
- [ ] `GET /api/gemini_chat.php?health=1` en verde (`status: ok`).
- [ ] Prueba end-to-end en `asistente.html` (texto + imagen) en verde.

## Desarrollo local

Este repositorio no incluye pipeline estándar de `lint/test/build` por `package.json` o `composer.json`.

## Extras añadidos para colaboración y calidad

- CI básico en GitHub Actions (`.github/workflows/ci.yml`) con:
  - validación de sintaxis PHP en `api/`
  - validación de sintaxis JavaScript en `assets/` y `components/`
- Plantilla de Pull Request: `.github/pull_request_template.md`
- Plantillas de Issues:
  - `.github/ISSUE_TEMPLATE/bug_report.yml`
  - `.github/ISSUE_TEMPLATE/feature_request.yml`
- Guía de contribución: `CONTRIBUTING.md`
