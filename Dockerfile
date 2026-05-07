FROM nginx:alpine

# Static site — copy /static contents into nginx web root
COPY static/ /usr/share/nginx/html/

# Custom nginx config for SPA-style serving (404 → index.html), gzip, security headers
RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
server {
    listen 8080 default_server;
    listen [::]:8080 default_server;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css text/xml application/json application/javascript image/svg+xml;
    gzip_min_length 256;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location = /health {
        access_log off;
        return 200 'ok';
        add_header Content-Type text/plain;
    }

    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }
}
EOF

EXPOSE 8080
