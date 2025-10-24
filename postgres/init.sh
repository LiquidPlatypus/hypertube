#!/bin/bash
set -e

cat > "/docker-entrypoint-initdb.d/init.sql" <<EOF
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '${POSTGRES_USER}') THEN
        CREATE USER ${POSTGRES_USER} WITH ENCRYPTED PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
END \$\$;

-- Créer la base de données si elle n'existe pas
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_DB}') THEN
        CREATE DATABASE ${POSTGRES_DB};
    END IF;
END \$\$;

-- Accorder les permissions si l'utilisateur et la base existent
DO \$\$
BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '${POSTGRES_USER}')
    AND EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_DB}') THEN
        GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};
    END IF;
END \$\$;
EOF

cp /docker-entrypoint-initdb.d/pg_hba.conf /var/lib/postgresql/data/pg_hba.conf