#!/bin/bash

# BrainwaveAI AWS EC2 Deployment Script
# This script clones the repo from GitHub and starts the backend

set -e

echo "🚀 Starting BrainwaveAI Backend Deployment..."

# Configuration
# IMPORTANT: Set your GitHub repository URL here or as environment variable
# Example: export GITHUB_REPO="https://github.com/yourusername/BrainwaveAI.git"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/YOUR_USERNAME/YOUR_REPO.git}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

# Validate GitHub repo is set
if [[ "$GITHUB_REPO" == *"YOUR_USERNAME/YOUR_REPO"* ]]; then
    echo "❌ ERROR: Please set your GitHub repository URL!"
    echo "Either:"
    echo "  1. Edit this script and change GITHUB_REPO variable"
    echo "  2. Or run: export GITHUB_REPO='https://github.com/yourusername/yourrepo.git'"
    exit 1
fi
APP_DIR="/home/ubuntu/brainwave-backend"
DOCKER_COMPOSE_FILE="aws-deployment/docker-compose.production.yml"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as ubuntu user
if [ "$USER" != "ubuntu" ]; then
    print_warning "This script is designed to run as 'ubuntu' user"
fi

# Update system packages
print_status "Updating system packages..."
sudo apt-get update

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
    sudo usermod -aG docker ubuntu
    print_status "Docker installed successfully"
else
    print_status "Docker already installed"
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    print_status "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed successfully"
else
    print_status "Docker Compose already installed"
fi

# Install Git if not installed
if ! command -v git &> /dev/null; then
    print_status "Installing Git..."
    sudo apt-get install -y git
else
    print_status "Git already installed"
fi

# Clone or update repository
if [ -d "$APP_DIR" ]; then
    print_status "Repository exists, pulling latest changes..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/$GITHUB_BRANCH
    git pull origin $GITHUB_BRANCH
else
    print_status "Cloning repository..."
    git clone -b $GITHUB_BRANCH $GITHUB_REPO $APP_DIR
    cd "$APP_DIR"
fi

# Check if .env.production exists
if [ ! -f "backend/.env.production" ]; then
    print_warning ".env.production not found!"
    print_warning "Creating from .env.example..."
    
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env.production
        print_warning "Please edit backend/.env.production with your production credentials"
        print_warning "Run: nano backend/.env.production"
        exit 1
    else
        print_error "No .env.example found. Please create backend/.env.production manually"
        exit 1
    fi
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose -f $DOCKER_COMPOSE_FILE down || true

# Build and start containers
print_status "Building Docker images..."
docker-compose -f $DOCKER_COMPOSE_FILE build --no-cache

print_status "Starting containers..."
docker-compose -f $DOCKER_COMPOSE_FILE up -d

# Wait for backend to be healthy
print_status "Waiting for backend to be ready..."
sleep 10

# Check if backend is running
if docker ps | grep -q brainwave-backend-prod; then
    print_status "Backend container is running"
    
    # Test health endpoint
    for i in {1..30}; do
        if curl -f http://localhost:8000/api/health &> /dev/null; then
            print_status "Backend is healthy and responding!"
            break
        fi
        echo "Waiting for backend to be ready... ($i/30)"
        sleep 2
    done
else
    print_error "Backend container failed to start"
    docker-compose -f $DOCKER_COMPOSE_FILE logs backend
    exit 1
fi

# Show running containers
print_status "Running containers:"
docker ps

# Show logs
print_status "Recent logs:"
docker-compose -f $DOCKER_COMPOSE_FILE logs --tail=50 backend

echo ""
print_status "🎉 Deployment completed successfully!"
echo ""
echo "Backend is running on: http://localhost:8000"
echo "API Documentation: http://localhost:8000/docs"
echo ""
echo "Useful commands:"
echo "  View logs:    docker-compose -f $DOCKER_COMPOSE_FILE logs -f backend"
echo "  Restart:      docker-compose -f $DOCKER_COMPOSE_FILE restart backend"
echo "  Stop:         docker-compose -f $DOCKER_COMPOSE_FILE down"
echo "  Shell access: docker exec -it brainwave-backend-prod bash"
echo ""
