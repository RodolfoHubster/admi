FROM php:8.2-apache

WORKDIR /var/www/html

COPY . /var/www/html

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "set -eu; sed -i \"s/Listen 80/Listen ${PORT}/\" /etc/apache2/ports.conf; sed -i \"s/<VirtualHost \\*:80>/<VirtualHost *:${PORT}>/\" /etc/apache2/sites-available/000-default.conf; exec apache2-foreground"]
