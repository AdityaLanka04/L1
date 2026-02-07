# AWS Deployment Files

This directory contains everything needed to deploy BrainwaveAI backend to AWS EC2.

## 📁 Files

- **AWS_SETUP_GUIDE.md** - Complete step-by-step deployment guide
- **deploy.sh** - Main deployment script (clones from GitHub and starts backend)
- **update.sh** - Quick update script (pulls latest code and restarts)
- **Dockerfile.production** - Production-optimized Docker image
- **docker-compose.production.yml** - Production Docker Compose configuration

## 🚀 Quick Start

### 1. Launch EC2 Instance

- **Instance Type**: t3.medium (recommended) or t3.small (budget)
- **AMI**: Ubuntu 22.04 LTS
- **Storage**: 30GB
- **Security Group**: Allow ports 22, 80, 443, 8000

### 2. Allocate Elastic IP

- Go to EC2 → Elastic IPs → Allocate
- Associate with your instance

### 3. Connect and Deploy

```bash
# SSH into your instance
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP

# Set your GitHub repo
export GITHUB_REPO="https://github.com/YOUR_USERNAME/YOUR_REPO.git"

# Download and run deployment script
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/aws-deployment/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

### 4. Configure Environment

Edit `.env.production` with your API keys:

```bash
nano backend/.env.production
```

### 5. Restart

```bash
./deploy.sh
```

## 📖 Full Documentation

See **AWS_SETUP_GUIDE.md** for complete instructions including:
- Detailed EC2 setup
- Nginx reverse proxy configuration
- SSL certificate setup
- Security best practices
- Monitoring and maintenance
- Troubleshooting

## 💰 Cost Estimate

**t3.medium (Recommended)**: ~$33-38/month
**t3.small (Budget)**: ~$17-19/month

## 🔧 Common Commands

```bash
# Update from GitHub
./update.sh

# View logs
docker-compose -f aws-deployment/docker-compose.production.yml logs -f backend

# Restart
docker-compose -f aws-deployment/docker-compose.production.yml restart backend

# Stop
docker-compose -f aws-deployment/docker-compose.production.yml down
```

## 📞 Need Help?

Check AWS_SETUP_GUIDE.md for troubleshooting section.
