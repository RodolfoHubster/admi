#!/bin/sh
set -eu

PORT="${PORT:-8080}"
RUNTIME_CONFIG_FILE="/var/www/html/assets/js/runtime-config.js"

if [ ! -f /etc/apache2/ports.conf ]; then
  echo "File /etc/apache2/ports.conf does not exist" >&2
  exit 1
fi

if [ ! -f /etc/apache2/sites-available/000-default.conf ]; then
  echo "File /etc/apache2/sites-available/000-default.conf does not exist" >&2
  exit 1
fi

if ! grep -q "Listen 80" /etc/apache2/ports.conf; then
  echo "Pattern 'Listen 80' not found in ports.conf" >&2
  exit 1
fi

if ! grep -q "<VirtualHost \\*:80>" /etc/apache2/sites-available/000-default.conf; then
  echo "Pattern '<VirtualHost *:80>' not found in 000-default.conf" >&2
  exit 1
fi

sed -i "s/Listen 80/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \\*:80>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

escape_js() {
  printf '%s' "${1:-}" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

asistente_endpoint="$(escape_js "${ASISTENTE_API_ENDPOINT:-}")"
asistente_health_endpoint="$(escape_js "${ASISTENTE_API_HEALTH_ENDPOINT:-}")"
exchange_endpoint="$(escape_js "${EXCHANGE_API_ENDPOINT:-https://api.exchangerate-api.com/v4/latest/USD}")"
exchange_health_endpoint="$(escape_js "${EXCHANGE_API_HEALTH_ENDPOINT:-}")"
exchange_api_key="$(escape_js "${EXCHANGE_API_KEY:-}")"
exchange_api_key_header="$(escape_js "${EXCHANGE_API_KEY_HEADER:-X-API-Key}")"
exchange_bearer_token="$(escape_js "${EXCHANGE_API_BEARER_TOKEN:-}")"
exchange_auth_header="$(escape_js "${EXCHANGE_API_AUTH_HEADER:-}")"
exchange_auth_scheme="$(escape_js "${EXCHANGE_API_AUTH_SCHEME:-Bearer}")"

cat > "${RUNTIME_CONFIG_FILE}" <<EOF
window.__APP_ENV__ = {
  ASISTENTE_API_ENDPOINT: "${asistente_endpoint}",
  ASISTENTE_API_HEALTH_ENDPOINT: "${asistente_health_endpoint}",
  EXCHANGE_API_ENDPOINT: "${exchange_endpoint}",
  EXCHANGE_API_HEALTH_ENDPOINT: "${exchange_health_endpoint}",
  EXCHANGE_API_KEY: "${exchange_api_key}",
  EXCHANGE_API_KEY_HEADER: "${exchange_api_key_header}",
  EXCHANGE_API_BEARER_TOKEN: "${exchange_bearer_token}",
  EXCHANGE_API_AUTH_HEADER: "${exchange_auth_header}",
  EXCHANGE_API_AUTH_SCHEME: "${exchange_auth_scheme}"
};
EOF

exec apache2-foreground
