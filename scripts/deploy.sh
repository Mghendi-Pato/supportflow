#!/bin/bash
# deploy.sh - called by GitHub Actions on every push to main
# Usage: bash deploy.sh <IMAGE_TAG>
# ============================================================
set -e   # Exit immediately if any command fails
set -a && source /opt/supportflow/.env && set +a

IMAGE_TAG=${1:-latest}
APP_DIR="/opt/supportflow"
COMPOSE_FILE="$APP_DIR/docker-compose.yml"

echo "----------------------------------------"
echo "Starting deployment - image tag: $IMAGE_TAG"
echo "----------------------------------------"

cd $APP_DIR

# Step 1: Log in to GitHub Container Registry
echo "Logging into GitHub Container Registry..."
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin

# Step 2: Pull the new images before stopping old containers to minimise downtime
echo "Pulling new images..."
IMAGE_TAG=$IMAGE_TAG docker compose pull backend frontend

# Step 3: Store the currently running image tag for rollback
PREVIOUS_TAG=$(docker inspect --format='{{index .Config.Labels "org.opencontainers.image.revision"}}' supportflow_api 2>/dev/null || echo "latest")
echo "Previous tag for rollback: $PREVIOUS_TAG"

# Step 4: Bring up the new containers
# --no-deps prevents restarting postgres
# --remove-orphans cleans up old containers not in compose file
# --force-recreate ensures old containers are stopped and replaced
echo "Swapping containers..."
IMAGE_TAG=$IMAGE_TAG docker compose up -d --no-deps --remove-orphans --force-recreate backend frontend

# Step 5: Wait for backend health check
echo "Waiting for backend health check..."
for i in $(seq 1 12); do
  if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "Backend is healthy!"
    break
  fi
  if [ $i -eq 12 ]; then
    echo "Backend failed health check after 60s - rolling back..."
    IMAGE_TAG=$PREVIOUS_TAG docker compose up -d --no-deps --force-recreate backend frontend
    echo "Rolled back to: $PREVIOUS_TAG"
    exit 1
  fi
  echo "   Attempt $i/12 - waiting 5s..."
  sleep 5
done

# Step 6: Clean up old unused images to save disk space
echo "Cleaning up old images..."
docker image prune -f --filter "until=24h"

echo ""
echo "----------------------------------------"
echo "Deployment complete! Tag: $IMAGE_TAG"
echo "----------------------------------------"
