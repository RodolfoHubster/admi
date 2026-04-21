# admi

Aplicación web estática para gestión de perfumes, con asistente IA en `asistente.html`.

## Procedimiento recomendado (2 APIs)

Este proyecto usa dos APIs en frontend:

1. API del asistente (`api/gemini_chat.php` desplegada en Cloud Run).
2. API de tipo de cambio (por defecto `https://api.exchangerate-api.com/v4/latest/USD`).

### 1) Confirmar APIs activas y credenciales válidas

- Asistente: valida `GET /api/gemini_chat.php?health=1` (debe devolver `status: ok`).
- Tipo de cambio: valida que el endpoint configurado responda con `rates.MXN`.

### 2) Guardar keys en variables de entorno (nunca en código)

Usa `.env.example` como base y crea `.env` local.

Variables clave:

- Backend Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL`, `ALLOWED_ORIGINS`.
- Front runtime (Cloud Run): `ASISTENTE_API_*`, `EXCHANGE_API_*`.

### 3) Configurar URL base y headers de autenticación en frontend

El frontend consume `window.__APP_ENV__` desde:

- `assets/js/runtime-config.js` (local/dev).
- Archivo generado automáticamente en contenedor por `docker-entrypoint.sh` usando variables de entorno.

### 4) Probar conexión básica a cada API

- Asistente: health-check `?health=1`.
- Tipo de cambio: request GET al endpoint configurado.

### 5) Manejo de errores HTTP en frontend

Se manejan mensajes específicos para:

- `401` (credenciales inválidas)
- `403` (origen/permisos)
- `429` (rate limit)
- `500+` (error servidor)

### 6) Validar flujo end-to-end

1. Abrir `asistente.html`.
2. Enviar mensaje sin imagen.
3. Enviar mensaje con imagen válida.
4. Verificar respuesta en UI y estado sin errores.

### 7) Aplicar restricciones de seguridad de keys

- Restringir `GEMINI_API_KEY` a Gemini API.
- Limitar por permisos mínimos requeridos.
- Usar Secret Manager para producción.

### 8) Revisar logs sin fuga de datos sensibles

Backend registra:

- `gemini_assistant.log`
- `gemini_assistant_security.log`
- `gemini_assistant_error.log`

Revisar que no se escriban secrets en logs.

### 9) Documentar despliegue y pruebas

Este README + `.env.example` cubren variables, despliegue y validación básica.

### 10) Paso a staging/producción

Checklist final:

- Variables de entorno configuradas.
- Health-check de ambas APIs en verde.
- Flujo UI validado.
- Monitoreo inicial y cuotas activas.

## Despliegue del backend Gemini en Google Cloud Run

GitHub Pages **no ejecuta PHP**, por lo que `api/gemini_chat.php` debe correr en un backend (Cloud Run recomendado).

### 1) Proyecto, billing y APIs de Google Cloud

```bash
gcloud billing projects describe TU_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

### 2) Despliega en Cloud Run

```bash
gcloud run deploy admi-gemini-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_MODEL=gemini-1.5-pro,ALLOWED_ORIGINS=https://rodolfohubster.github.io \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

### 3) Configura frontend por variables de entorno

Ejemplo al desplegar en Cloud Run:

```bash
--set-env-vars ASISTENTE_API_ENDPOINT=https://admi-gemini-api-PROJECT-HASH-uc.a.run.app/api/gemini_chat.php,EXCHANGE_API_ENDPOINT=https://api.exchangerate-api.com/v4/latest/USD
```

## Recomendaciones de seguridad

- Nunca pongas `GEMINI_API_KEY` en HTML/JS público.
- Restringe la key en Google Cloud a la API de Gemini.
- Rota la key periódicamente.
- Monitorea uso y cuotas.
- Mantén validación de origen + rate limit en backend.

## Desarrollo local

Este repositorio no incluye pipeline de build/test/lint definido por `package.json` o `composer.json`.

### Variables de entorno locales

1. Copia `.env.example` a `.env`.
2. Completa tus valores reales (API key y credenciales de BD).
