#!/bin/sh
set -eu

# Render nginx.conf from the template, substituting ONLY the variables listed
# below — nginx's own config syntax is full of "$..." tokens ($host, $uri,
# $http_upgrade, ...) that envsubst must never touch.
envsubst '${INTERNAL_SECRET}' \
    < /usr/local/nginx/conf/nginx.conf.template \
    > /usr/local/nginx/conf/nginx.conf

exec /usr/local/nginx/sbin/nginx -g "daemon off;"
