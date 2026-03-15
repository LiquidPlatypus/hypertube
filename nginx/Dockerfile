FROM node:20-alpine AS builder
WORKDIR /app
COPY app/frontend/package*.json ./
RUN npm install
COPY app/frontend .
RUN npm run build

FROM debian:bullseye-slim

RUN apt-get update -y && apt-get install -y \
    build-essential \
    libpcre3 \
    libpcre3-dev \
    libpcre2-dev \
    libssl-dev \
    zlib1g-dev \
    wget \
    curl \
    gnupg2 \
    openssl

RUN wget https://nginx.org/download/nginx-1.24.0.tar.gz && \
    wget https://github.com/nbs-system/naxsi/archive/master.tar.gz && \
    tar -zxvf nginx-1.24.0.tar.gz && \
    tar -zxvf master.tar.gz && \
    cd nginx-1.24.0 && \
    ./configure --with-http_ssl_module --add-module=../naxsi-master/naxsi_src && \
    make && \
    make install

RUN mkdir -p /etc/nginx/ssl /var/log/nginx \
    && openssl req -newkey rsa:4096 -x509 -sha256 -days 365 -nodes \
        -out /etc/nginx/ssl/hypertube.crt \
        -keyout /etc/nginx/ssl/hypertube.key \
        -subj "/C=FR/ST=MULHOUSE/L=MULHOUSE/O=42 School/OU=hypertube/CN=hypertube/"

COPY nginx/nginx.conf /usr/local/nginx/conf/.
COPY nginx/naxsi.rules /usr/local/nginx/conf/.
COPY nginx/mime.types /etc/nginx/.
COPY nginx/naxsi_core.rules /usr/local/nginx/conf/.

COPY --from=builder /app/dist /usr/local/nginx/html

EXPOSE 80 443

CMD ["/usr/local/nginx/sbin/nginx", "-g", "daemon off;"]