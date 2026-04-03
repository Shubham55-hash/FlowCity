#!/usr/bin/env bash
# deploy/scripts/provision_ec2.sh
# ─────────────────────────────────────────────────────────────────────────────
# Bootstraps a fresh Amazon Linux 2023 EC2 instance for FlowCity.
# Run once as root / via user-data.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/opt/flowcity"

echo "==> Updating system packages"
dnf update -y

echo "==> Installing Docker"
dnf install -y docker
systemctl enable --now docker
usermod -aG docker ec2-user

echo "==> Installing Docker Compose plugin"
DOCKER_COMPOSE_VERSION="2.27.0"
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

echo "==> Installing AWS CLI v2"
dnf install -y unzip
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp
/tmp/aws/install
rm -rf /tmp/aws /tmp/awscliv2.zip

echo "==> Installing CloudWatch Agent"
dnf install -y amazon-cloudwatch-agent

echo "==> Creating app directory"
mkdir -p "${APP_DIR}"
chown ec2-user:ec2-user "${APP_DIR}"

echo "==> Configuring log rotation"
cat > /etc/logrotate.d/flowcity <<'EOF'
/var/log/flowcity/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 ec2-user ec2-user
}
EOF

echo "==> Enabling automatic security updates"
dnf install -y dnf-automatic
systemctl enable --now dnf-automatic-install.timer

echo "==> Provisioning complete. Reboot recommended."
