#!/bin/bash

# Quick update script - pulls latest code and restarts

set -e

APP_DIR="/home/ubuntu/brainwave-backend"
DOCKER_COMPOSE_FILE="aws-deployment/docker-compose.production.yml"

echo "🔄 Updating BrainwaveAI Backend..."

cd $APP_DIR

# Pull latest changes
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# Rebuild and restart
echo "🔨 Rebuilding containers..."
docker-compose -f $DOCKER_COMPOSE_FILE down
docker-compose -f $DOCKER_COMPOSE_FILE build --no-cache
docker-compose -f $DOCKER_COMPOSE_FILE up -d

echo "⏳ Waiting for backend to be ready..."
sleep 10

# Check health
if curl -f http://localhost:8000/api/health &> /dev/null; then
    echo "✅ Update completed successfully!"
    docker-compose -f $DOCKER_COMPOSE_FILE logs --tail=20 backend
else
    echo "❌ Backend health check failed"
    docker-compose -f $DOCKER_COMPOSE_FILE logs backend
    exit 1
fi
