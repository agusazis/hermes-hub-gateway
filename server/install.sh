#!/usr/bin/env bash
# ==============================================================================
# Hermes Hub Companion Daemon Installer (One-Liner Provisioning)
# Target: Linux Server running Hermes Agent / Python 3.10+
# ==============================================================================

set -euo pipefail

EVALUATOR_PORT="${EVALUATOR_PORT:-9125}"
INSTALL_DIR="${HOME}/.hermes/scripts"
SERVICE_NAME="hermes-antigravity-review.service"
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"

echo "=== [1/4] Preparing Directories ==="
mkdir -p "${INSTALL_DIR}"
mkdir -p "${HOME}/.hermes/logs"
mkdir -p "${SYSTEMD_USER_DIR}"

echo "=== [2/4] Deploying Companion Daemon (antigravity_review_receiver.py) ==="
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/antigravity_review_receiver.py"

if [ -f "${SCRIPT_PATH}" ]; then
    cp "${SCRIPT_PATH}" "${INSTALL_DIR}/antigravity_review_receiver.py"
    chmod +x "${INSTALL_DIR}/antigravity_review_receiver.py"
    echo "✓ Installed local receiver script to ${INSTALL_DIR}"
else
    # Remote fallback
    curl -fsSL https://raw.githubusercontent.com/agusazis/hermes-hub-gateway/main/server/antigravity_review_receiver.py -o "${INSTALL_DIR}/antigravity_review_receiver.py"
    chmod +x "${INSTALL_DIR}/antigravity_review_receiver.py"
    echo "✓ Downloaded receiver script from GitHub to ${INSTALL_DIR}"
fi

echo "=== [3/4] Configuring Systemd User Service ==="
cat <<EOF > "${SYSTEMD_USER_DIR}/${SERVICE_NAME}"
[Unit]
Description=Hermes Hub Companion Daemon - Antigravity Review & Evolution Engine
After=network.target

[Service]
Type=simple
WorkingDirectory=${HOME}
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/antigravity_review_receiver.py
Restart=always
RestartSec=5
Environment=PORT=${EVALUATOR_PORT}
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=default.target
EOF

echo "=== [4/4] Starting & Enabling Companion Daemon ==="
systemctl --user daemon-reload
systemctl --user enable --now "${SERVICE_NAME}"

echo ""
echo "🎉 Hermes Hub Companion Daemon successfully installed and running on port :${EVALUATOR_PORT}!"
echo "Check status anytime with: systemctl --user status ${SERVICE_NAME}"
