FROM postgres:16

RUN mkdir -p /docker-entrypoint-initdb.d/ && chmod 777 /docker-entrypoint-initdb.d/

COPY ./init.sh /docker-entrypoint-initdb.d/init.sh
COPY ./pg_hba.conf /docker-entrypoint-initdb.d/pg_hba.conf

RUN chmod +x /docker-entrypoint-initdb.d/init.sh 