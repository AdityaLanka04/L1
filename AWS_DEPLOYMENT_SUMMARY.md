# 🚀 AWS EC2 Deployment - Quick Start Summary

## What You Got

I've created a complete AWS EC2 deployment setup for your BrainwaveAI backend in the `aws-deployment/` folder.

## 📦 Files Created

```
aws-deployment/
├── AWS_SETUP_GUIDE.md              # Complete step-by-step guide
├── QUICK_REFERENCE.md              # Command cheat sheet
├── README.md                       # Overview
├── Dockerfile.production           # Production Docker image
├── docker-compose.production.yml   # Production compose config
├── deploy.sh                       # Main deployment script ⭐
├── update.sh                       # Quick update script
└── setup-swap.sh                   # Swap setup for low RAM

.github/workflows/
└── deploy-to-ec2.yml              # Auto-deploy on git push (optional)
```

## 💰 Recommended EC2 Instance

**Best Choice: t3.medium**
- 2 vCPUs, 4GB RAM
- Cost: ~$30-35/month
- Handles AI workloads well

**Budget Option: t3.small**
- 2 vCPUs, 2GB RAM  
- Cost: ~$15-17/month
- May struggle with heavy AI processing

## 🎯 Quick Deployment Steps

### 1. Launch EC2 Instance
- Go to AWS Console → EC2 → Launch Instance
- Choose Ubuntu 22.04 LTS
- Select t3.medium (or t3.small)
- Configure security group (ports: 22, 80, 443, 8000)
- Download your .pem key file

### 2. Get Elastic IP (Static IP)
- EC2 → Elastic IPs → Allocate
- Associate with your instance
- **This is your permanent IP that won't change!**

### 3. Connect to EC2
```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
```

### 4. Deploy Backend
```bash
# Set your GitHub repo URL
export GITHUB_REPO="https://github.com/YOUR_USERNAME/YOUR_REPO.git"

# Download and run deployment script
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/aws-deployment/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

### 5. Configure Environment
```bash
nano backend/.env.production
```

Add your API keys:
```env
SECRET_KEY=your-secret-key-here
GOOGLE_GENERATIVE_AI_KEY=your-gemini-api-key
DATABASE_URL=sqlite:///./brainwave_tutor.db
ENV=production
```

### 6. Restart
```bash
./deploy.sh
```

### 7. Test
```bash
curl http://YOUR_ELASTIC_IP:8000/api/health
```

## 🌐 Access Your Backend

- **API**: `http://YOUR_ELASTIC_IP:8000`
- **Docs**: `http://YOUR_ELASTIC_IP:8000/docs`
- **Health**: `http://YOUR_ELASTIC_IP:8000/api/health`

## 🔧 Common Commands

```bash
# Update from GitHub
./update.sh

# View logs
docker-compose -f aws-deployment/docker-compose.production.yml logs -f backend

# Restart backend
docker-compose -f aws-deployment/docker-compose.production.yml restart backend

# Stop everything
docker-compose -f aws-deployment/docker-compose.production.yml down
```

## 📱 Connect Your Frontend

Update your frontend config to point to EC2:

```env
REACT_APP_API_URL=http://YOUR_ELASTIC_IP:8000
```

## 🔒 Security Group Configuration

Make sure these ports are open in your EC2 security group:

| Port | Purpose |
|------|---------|
| 22 | SSH (restrict to your IP) |
| 80 | HTTP |
| 443 | HTTPS |
| 8000 | Backend API |

## 💡 Pro Tips

1. **Elastic IP is FREE** when attached to a running instance
2. **Setup Nginx** as reverse proxy (instructions in AWS_SETUP_GUIDE.md)
3. **Add SSL** with Let's Encrypt for HTTPS (free)
4. **Setup swap** if using t3.small: `./setup-swap.sh`
5. **Enable auto-deploy** by adding EC2 SSH key to GitHub Secrets

## 📚 Full Documentation

- **Complete Guide**: `aws-deployment/AWS_SETUP_GUIDE.md`
- **Quick Reference**: `aws-deployment/QUICK_REFERENCE.md`
- **Troubleshooting**: See AWS_SETUP_GUIDE.md

## 🚨 Important Notes

1. **Before deploying**, push all your code to GitHub
2. **Update GitHub repo URL** in deploy.sh or set GITHUB_REPO environment variable
3. **Don't forget** to configure .env.production with your API keys
4. **Elastic IP** ensures your IP won't change when you stop/start instance
5. **Backup regularly** - especially the SQLite database

## 🎉 What Happens When You Deploy

1. ✅ Installs Docker & Docker Compose
2. ✅ Clones your repo from GitHub
3. ✅ Builds production Docker image
4. ✅ Starts backend container
5. ✅ Runs health checks
6. ✅ Shows logs and status

## 📞 Need Help?

Check the troubleshooting section in `aws-deployment/AWS_SETUP_GUIDE.md`

## 🔄 Auto-Deploy on Git Push (Optional)

To enable automatic deployment when you push to GitHub:

1. Add these secrets to your GitHub repo:
   - `EC2_HOST`: Your Elastic IP
   - `EC2_SSH_KEY`: Contents of your .pem file

2. Push to main branch - it will auto-deploy!

## 📚 Additional Documentation

- **Complete Setup Guide**: `aws-deployment/AWS_SETUP_GUIDE.md`
- **Quick Reference**: `aws-deployment/QUICK_REFERENCE.md`
- **Deployment Checklist**: `aws-deployment/DEPLOYMENT_CHECKLIST.md`
- **Architecture Diagram**: `aws-deployment/ARCHITECTURE.md`
- **Troubleshooting**: `aws-deployment/TROUBLESHOOTING.md`

## ⚠️ Important Notes Before Deploying

1. **Update GitHub Repository URL** in `deploy.sh` or set environment variable:
   ```bash
   export GITHUB_REPO="https://github.com/YOUR_USERNAME/YOUR_REPO.git"
   ```

2. **Push all your code to GitHub** before deploying

3. **Have your API keys ready**:
   - Google Gemini API key
   - Any other service API keys

4. **Budget**: Expect ~$30-35/month for t3.medium or ~$15-17/month for t3.small

---

**Ready to deploy?** Follow the steps above or read the full guide in `aws-deployment/AWS_SETUP_GUIDE.md`
