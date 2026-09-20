FROM nginx:alpine

# Static site — copy /static contents into nginx web root
COPY static/ /usr/share/nginx/html/

# Custom nginx config for SPA-style serving (404 → index.html), gzip, security headers
RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
map $uri $public_cache {
    default "no-cache";
    ~*\.(css|js)$ "public, max-age=3600, must-revalidate";
    ~*\.(png|jpe?g|webp|svg|ico|mp4|mp3|vtt|woff2?)$ "public, max-age=86400";
}
# Only legacy pages require inline scripts/handlers. The home and service guide do not.
map $uri $page_script {
    default "'self' https://enabler-analytics.fly.dev";
    ~^/(2036|press/sente-iphone)(/|$) "'self' 'unsafe-inline' https://enabler-analytics.fly.dev";
}
server {
    listen 8080 default_server;
    listen [::]:8080 default_server;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Behind Fly's TLS proxy (internal port 8080). Without this, directory
    # redirects leak ":8080" into the Location header (e.g. /2036 -> :8080/2036/).
    absolute_redirect off;

    gzip on;
    gzip_types text/plain text/css text/xml application/json application/javascript image/svg+xml;
    gzip_min_length 256;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src $page_script; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self'; connect-src 'self' https://enabler-analytics.fly.dev; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'" always;
    add_header Cache-Control $public_cache;

    location = /health {
        access_log off;
        return 200 'ok';
        default_type text/plain;
    }

    location ~* \.(css|js|png|jpe?g|webp|svg|ico|mp4|mp3|vtt|woff2?)$ {
        try_files $uri =404;
    }
    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }
}
EOF

EXPOSE 8080
