#!/usr/bin/env bash
# deploy/scripts/ssl_setup.sh
# ─────────────────────────────────────────────────────────────────────────────
# Obtains Let's Encrypt certificates via Certbot and configures Nginx for TLS.
# Run once after DNS is pointed at the server.
# Usage: ./ssl_setup.sh flowcity.app staging.flowcity.app admin@flowcity.app
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> [staging_domain] <email>}"
STAGING_DOMAIN="${2:-}"
EMAIL="${3:?Provide an email for Let's Encrypt}"

echo "==> Installing Certbot"
snap install --classic certbot 2>/dev/null || dnf install -y certbot python3-certbot-nginx

DOMAINS="-d ${DOMAIN}"
[ -n "${STAGING_DOMAIN}" ] && DOMAINS="${DOMAINS} -d ${STAGING_DOMAIN}"

echo "==> Obtaining certificate for ${DOMAIN}"
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "${EMAIL}" \
  ${DOMAINS}

echo "==> Writing Nginx TLS config"
cat > /etc/nginx/conf.d/flowcity_ssl.conf <<EOF
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name ${DOMAIN} ${STAGING_DOMAIN};
    return 301 https://\$host\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    # Mozilla Intermediate TLS config
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS (2 years)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 1.1.1.1 valid=300s;

    # Proxy to frontend container
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # WebSocket support for Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

echo "==> Testing and reloading Nginx"
nginx -t && systemctl reload nginx

echo "==> Setting up auto-renewal cron"
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -

echo "==> SSL setup complete ✓"
