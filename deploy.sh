#!/usr/bin/env bash
# Run on the droplet to deploy (or update) the IFA Backtest Product.
#
# First-time setup (run once after cloning):
#   1. Copy .env.production from your local machine to /opt/ifa-backtest-product/.env.production
#   2. Copy backend/secrets/firebase-admin.json to /opt/ifa-backtest-product/backend/secrets/firebase-admin.json
#   3. chmod +x deploy.sh
#
# Subsequent deploys: just run ./deploy.sh

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/ifa-backtest-product}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

cd "$REPO_DIR"

echo "═══ pulling latest from main ═══"
git fetch origin main
git reset --hard origin/main

echo "═══ sanity-checking env ═══"
test -f "$ENV_FILE"             || { echo "✗ Missing $ENV_FILE"; exit 1; }
test -f "backend/secrets/firebase-admin.json" || { echo "✗ Missing backend/secrets/firebase-admin.json"; exit 1; }

# Load env so frontend build-args see VITE_* values
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "═══ building images ═══"
docker compose -f "$COMPOSE_FILE" build --pull

echo "═══ running DB migrations ═══"
# alembic.ini lives at /app/backend/alembic.ini inside the container (the
# Dockerfile preserves the dev layout). The container WORKDIR is /app, so
# point alembic at the config explicitly or it errors with
# "No 'script_location' key found in configuration".
docker compose -f "$COMPOSE_FILE" run --rm --workdir /app/backend backend alembic upgrade head

echo "═══ restarting services ═══"
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "═══ pruning stale images ═══"
docker image prune -f >/dev/null

echo "═══ health check ═══"
sleep 5
for i in 1 2 3 4 5; do
    if curl -fsS http://127.0.0.1:8000/healthz >/dev/null; then
        echo "✓ Backend healthy"
        break
    fi
    echo "  waiting for backend ($i/5)..."
    sleep 3
done

if curl -fsS http://127.0.0.1:5173/ >/dev/null; then
    echo "✓ Frontend serving"
else
    echo "✗ Frontend not responding on :5173"
    exit 1
fi

echo
echo "═══ deploy complete ═══"
docker compose -f "$COMPOSE_FILE" ps
