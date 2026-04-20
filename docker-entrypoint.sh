#!/bin/sh
set -eu

PORT="${PORT:-8080}"

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

exec apache2-foreground
