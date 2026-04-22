# Contribuir a admi

Gracias por contribuir. Para mantener cambios seguros y consistentes:

## Flujo recomendado
1. Crea una rama desde `main`.
2. Haz cambios pequeños y enfocados.
3. Verifica sintaxis antes de abrir PR:
   - PHP: `find api -name '*.php' -print0 | xargs -0 -n1 php -l`
   - JS: `find assets components -name '*.js' -print0 | xargs -0 -n1 node --check`
4. Abre Pull Request usando la plantilla.

## Reglas de seguridad
- No subir secretos (`.env`, API keys, tokens, credenciales).
- Mantener `GEMINI_API_KEY` solo en backend/secret manager.
- Evitar exponer datos sensibles en logs o respuestas de error.

## Alcance de cambios
- Evitar mezclar refactors amplios con fixes funcionales.
- Si cambias comportamiento visible, actualiza `README.md`.

## Reporte de bugs y mejoras
- Usa las plantillas de Issue para reportar bugs o proponer features.
- Incluye pasos de reproducción y contexto suficiente.
