FROM php:8.2-apache

WORKDIR /var/www/html

COPY . /var/www/html

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV PORT=8080
EXPOSE 8080

CMD ["/usr/local/bin/docker-entrypoint.sh"]
