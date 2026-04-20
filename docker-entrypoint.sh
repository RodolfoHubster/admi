#!/bin/sh
set -eu

PORT="${PORT:-8080}"

if [ ! -f /etc/apache2/ports.conf ]; then
  echo "No existe /etc/apache2/ports.conf" >&2
  exit 1
fi

if [ ! -f /etc/apache2/sites-available/000-default.conf ]; then
  echo "No existe /etc/apache2/sites-available/000-default.conf" >&2
  exit 1
fi

if ! grep -q "Listen 80" /etc/apache2/ports.conf; then
  echo "No se encontró el patrón 'Listen 80' en ports.conf" >&2
  exit 1
fi

if ! grep -q "<VirtualHost \\*:80>" /etc/apache2/sites-available/000-default.conf; then
  echo "No se encontró el patrón '<VirtualHost *:80>' en 000-default.conf" >&2
  exit 1
fi

sed -i "s/Listen 80/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \\*:80>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

exec apache2-foreground
