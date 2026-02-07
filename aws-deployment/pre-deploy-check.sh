#!/bin/bash

# Pre-deployment validation script
# Run this BEFORE deploying to catch common issues

set -e

echo "🔍 Running pre-deployment checks..."
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

print_error() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Check 1: Git repository
echo "Checking Git repository..."
if [ -d .git ]; then
    print_success "Git repository found"
    
    # Check for uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "You have uncommitted changes. Consider committing before deploying."
    else
        print_success "No uncommitted changes"
    fi
    
    # Check remote
    if git remote -v | grep -q origin; then
        REMOTE_URL=$(git remote get-url origin)
        print_success "Git remote configured: $REMOTE_URL"
    else
        print_error "No git remote 'origin' configured"
    fi
else
    print_error "Not a git repository. Initialize with: git init"
fi

echo ""

# Check 2: Backend files
echo "Checking backend files..."
if [ -f backend/main.py ]; then
    print_success "backend/main.py exists"
else
    print_error "backend/main.py not found"
fi

if [ -f backend/requirements.txt ]; then
    print_success "backend/requirements.txt exists"
else
    print_error "backend/requirements.txt not found"
fi

if [ -f backend/Dockerfile ]; then
    print_success "backend/Dockerfile exists"
else
    print_warning "backend/Dockerfile not found (will use production Dockerfile)"
fi

echo ""

# Check 3: Environment files
echo "Checking environment configuration..."
if [ -f backend/.env.example ]; then
    print_success "backend/.env.example exists"
else
    print_warning "backend/.env.example not found"
fi

if [ -f backend/.env.production ]; then
    print_warning "backend/.env.production exists locally (will need to be configured on EC2)"
    
    # Check for placeholder values
    if grep -q "your-.*-here" backend/.env.production; then
        print_warning "backend/.env.production contains placeholder values"
    fi
    
    # Check for required keys
    if grep -q "GOOGLE_GENERATIVE_AI_KEY" backend/.env.production; then
        print_success "GOOGLE_GENERATIVE_AI_KEY found in .env.production"
    else
        print_error "GOOGLE_GENERATIVE_AI_KEY not found in .env.production"
    fi
    
    if grep -q "SECRET_KEY" backend/.env.production; then
        print_success "SECRET_KEY found in .env.production"
    else
        print_error "SECRET_KEY not found in .env.production"
    fi
else
    print_warning "backend/.env.production not found (will be created from .env.example on EC2)"
fi

echo ""

# Check 4: Deployment files
echo "Checking deployment files..."
if [ -f aws-deployment/deploy.sh ]; then
    print_success "aws-deployment/deploy.sh exists"
    
    # Check if executable
    if [ -x aws-deployment/deploy.sh ]; then
        print_success "deploy.sh is executable"
    else
        print_warning "deploy.sh is not executable. Run: chmod +x aws-deployment/deploy.sh"
    fi
else
    print_error "aws-deployment/deploy.sh not found"
fi

if [ -f aws-deployment/docker-compose.production.yml ]; then
    print_success "aws-deployment/docker-compose.production.yml exists"
else
    print_error "aws-deployment/docker-compose.production.yml not found"
fi

if [ -f aws-deployment/Dockerfile.production ]; then
    print_success "aws-deployment/Dockerfile.production exists"
else
    print_error "aws-deployment/Dockerfile.production not found"
fi

echo ""

# Check 5: GitHub repository URL in deploy.sh
echo "Checking GitHub repository configuration..."
if grep -q "YOUR_USERNAME/YOUR_REPO" aws-deployment/deploy.sh; then
    print_error "deploy.sh still contains placeholder GitHub URL"
    echo "  Update GITHUB_REPO in deploy.sh or set environment variable"
else
    print_success "GitHub repository URL appears to be configured"
fi

echo ""

# Check 6: Documentation
echo "Checking documentation..."
if [ -f aws-deployment/AWS_SETUP_GUIDE.md ]; then
    print_success "AWS_SETUP_GUIDE.md exists"
else
    print_warning "AWS_SETUP_GUIDE.md not found"
fi

if [ -f aws-deployment/QUICK_REFERENCE.md ]; then
    print_success "QUICK_REFERENCE.md exists"
else
    print_warning "QUICK_REFERENCE.md not found"
fi

echo ""

# Check 7: Python dependencies
echo "Checking Python dependencies..."
if [ -f backend/requirements.txt ]; then
    # Check for common required packages
    if grep -q "fastapi" backend/requirements.txt; then
        print_success "FastAPI found in requirements.txt"
    else
        print_error "FastAPI not found in requirements.txt"
    fi
    
    if grep -q "uvicorn" backend/requirements.txt; then
        print_success "Uvicorn found in requirements.txt"
    else
        print_error "Uvicorn not found in requirements.txt"
    fi
    
    if grep -q "gunicorn" backend/requirements.txt; then
        print_success "Gunicorn found in requirements.txt"
    else
        print_warning "Gunicorn not found in requirements.txt (needed for production)"
    fi
fi

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready to deploy.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Push your code to GitHub"
    echo "2. Launch EC2 instance"
    echo "3. Run deploy.sh on EC2"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    echo "You can proceed with deployment, but review warnings above."
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found${NC}"
    echo "Please fix errors before deploying."
    exit 1
fi
