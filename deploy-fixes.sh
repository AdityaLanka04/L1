#!/bin/bash
# Deploy critical bug fixes to AWS EC2

set -e

echo "🚀 Deploying Critical Bug Fixes to AWS EC2"
echo "=========================================="

# Configuration
EC2_HOST="ubuntu@ec2-16-170-49-253.eu-north-1.compute.amazonaws.com"
KEY_FILE="lanka.pem"
REMOTE_DIR="/home/ubuntu/brainwave-backend"

echo ""
echo "📦 Step 1: Copying fixed files to EC2..."
echo ""

# Copy fixed files
scp -i "$KEY_FILE" backend/.env.production "$EC2_HOST:$REMOTE_DIR/backend/.env.production"
scp -i "$KEY_FILE" backend/caching/semantic_cache.py "$EC2_HOST:$REMOTE_DIR/backend/caching/semantic_cache.py"
scp -i "$KEY_FILE" backend/agents/learning_progress_tracker.py "$EC2_HOST:$REMOTE_DIR/backend/agents/learning_progress_tracker.py"
scp -i "$KEY_FILE" backend/agents/rag/user_rag_manager.py "$EC2_HOST:$REMOTE_DIR/backend/agents/rag/user_rag_manager.py"

echo ""
echo "✅ Files copied successfully"
echo ""
echo "🔄 Step 2: Restarting backend container..."
echo ""

# Restart the backend container
ssh -i "$KEY_FILE" "$EC2_HOST" << 'ENDSSH'
cd /home/ubuntu/brainwave-backend
docker-compose -f docker-compose.production.yml restart backend
echo ""
echo "⏳ Waiting for backend to start..."
sleep 10
echo ""
echo "📊 Checking backend status..."
docker-compose -f docker-compose.production.yml ps
echo ""
echo "📋 Recent logs:"
docker-compose -f docker-compose.production.yml logs --tail=30 backend
ENDSSH

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "🔍 What was fixed:"
echo "  1. ✅ Disabled semantic cache (ENABLE_RESPONSE_CACHING=false)"
echo "  2. ✅ Increased cache similarity threshold (95% → 98%)"
echo "  3. ✅ Lowered learning path confidence threshold (30% → 20%)"
echo "  4. ✅ Fixed PostgreSQL datetime syntax in 4 queries"
echo ""
echo "🧪 Test the fixes:"
echo "  1. Generate flashcards on different topics - should NOT return cached content"
echo "  2. Ask chat questions - should get fresh responses"
echo "  3. Check learning path progress updates"
echo ""
