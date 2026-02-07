# 🚀 Deploy BrainwaveAI Backend to AWS EC2

Complete guide to deploy your backend to AWS EC2 with Docker.

## 📋 What You Need

- [ ] AWS Account
- [ ] GitHub repository with your code
- [ ] Credit card for AWS billing
- [ ] Your API keys (Gemini, etc.)
- [ ] 30 minutes of time

## 💰 Cost: ~$30-35/month (or ~$15-17 for budget option)

---

## 🎯 Quick Start (5 Steps)

### Step 1: Prepare Your Code

```bash
# Run pre-deployment check
./aws-deployment/pre-deploy-check.sh

# Fix any errors, then push to GitHub
git add .
git commit -m "Ready for AWS deployment"
git push origin main
```

### Step 2: Launch EC2 Instance

1. Go to [AWS EC2 Console](https://console.aws.amazon.com/ec2/)
2. Click **Launch Instance**
3. Configure:
   - **Name**: `brainwave-backend`
   - **AMI**: Ubuntu Server 22.04 LTS
   - **Instance Type**: `t3.medium` (recommended) or `t3.small` (budget)
   - **Key Pair**: Create new (download .pem file)
   - **Storage**: 30GB gp3
   - **Security Group**: Allow ports 22, 80, 443, 8000
4. Click **Launch Instance**

### Step 3: Get Static IP (Elastic IP)

1. Go to **EC2** → **Elastic IPs**
2. Click **Allocate Elastic IP address**
3. Click **Associate Elastic IP address**
4. Select your instance
5. **Note down this IP** - this is your permanent backend URL!

### Step 4: Deploy Backend

```bash
# Connect to EC2
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP

# Set your GitHub repo (IMPORTANT!)
export GITHUB_REPO="https://github.com/YOUR_USERNAME/YOUR_REPO.git"

# Download and run deployment
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/aws-deployment/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

### Step 5: Configure & Start

```bash
# Edit environment variables
nano backend/.env.production

# Add your API keys:
# SECRET_KEY=your-secret-key
# GOOGLE_GENERATIVE_AI_KEY=your-gemini-key

# Save (Ctrl+X, Y, Enter)

# Restart deployment
./deploy.sh
```

**Done!** Your backend is now running at `http://YOUR_ELASTIC_IP:8000`

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[AWS_SETUP_GUIDE.md](aws-deployment/AWS_SETUP_GUIDE.md)** | Complete step-by-step guide with screenshots |
| **[QUICK_REFERENCE.md](aws-deployment/QUICK_REFERENCE.md)** | Command cheat sheet |
| **[DEPLOYMENT_CHECKLIST.md](aws-deployment/DEPLOYMENT_CHECKLIST.md)** | Printable checklist |
| **[ARCHITECTURE.md](aws-deployment/ARCHITECTURE.md)** | System architecture diagrams |
| **[TROUBLESHOOTING.md](aws-deployment/TROUBLESHOOTING.md)** | Common issues & solutions |

---

## 🔧 Useful Commands

```bash
# View logs
docker-compose -f aws-deployment/docker-compose.production.yml logs -f backend

# Restart backend
docker-compose -f aws-deployment/docker-compose.production.yml restart backend

# Update from GitHub
./update.sh

# Check status
docker ps
curl http://localhost:8000/api/health

# Stop everything
docker-compose -f aws-deployment/docker-compose.production.yml down
```

---

## 🌐 Access Your Backend

Once deployed, your backend will be available at:

- **API**: `http://YOUR_ELASTIC_IP:8000`
- **API Docs**: `http://YOUR_ELASTIC_IP:8000/docs`
- **Health Check**: `http://YOUR_ELASTIC_IP:8000/api/health`

Update your frontend to use this URL:

```env
REACT_APP_API_URL=http://YOUR_ELASTIC_IP:8000
```

---

## 🔒 Security Group Ports

Make sure these ports are open in your EC2 security group:

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Your IP | SSH access |
| 80 | TCP | 0.0.0.0/0 | HTTP |
| 443 | TCP | 0.0.0.0/0 | HTTPS |
| 8000 | TCP | 0.0.0.0/0 | Backend API |

---

## 💡 Recommendations

### Instance Type

| Instance | vCPU | RAM | Cost/Month | Best For |
|----------|------|-----|------------|----------|
| **t3.medium** ⭐ | 2 | 4GB | $30-35 | Recommended - handles AI well |
| t3.small | 2 | 2GB | $15-17 | Budget - may struggle with AI |
| t3.large | 2 | 8GB | $60-70 | High traffic |

### Optional Enhancements

1. **Setup Nginx** (reverse proxy + SSL)
   - Better performance
   - Free SSL with Let's Encrypt
   - See AWS_SETUP_GUIDE.md

2. **Setup Auto-Deploy**
   - Deploys automatically on git push
   - Add EC2 SSH key to GitHub Secrets
   - Already configured in `.github/workflows/`

3. **Add Monitoring**
   - CloudWatch for AWS metrics
   - Application logs via Docker
   - Disk space alerts

---

## 🚨 Important Notes

1. **Elastic IP is FREE** when attached to a running instance
2. **Stop instance** when not in use to save money (but IP stays the same!)
3. **Backup regularly** - especially the database
4. **Update GitHub repo URL** in deploy.sh before deploying
5. **Keep .pem file safe** - you can't download it again

---

## 🐛 Troubleshooting

### Can't connect to EC2?
- Check security group allows SSH (port 22) from your IP
- Verify key file permissions: `chmod 400 your-key.pem`
- Use correct username: `ubuntu` (not ec2-user)

### Backend won't start?
```bash
# Check logs
docker-compose -f aws-deployment/docker-compose.production.yml logs backend

# Common fix: restart
docker-compose -f aws-deployment/docker-compose.production.yml restart backend
```

### Out of memory?
```bash
# Add swap (especially for t3.small)
./setup-swap.sh
```

**More solutions**: See [TROUBLESHOOTING.md](aws-deployment/TROUBLESHOOTING.md)

---

## 📞 Need Help?

1. **Check logs first**: `docker-compose logs backend`
2. **Read troubleshooting guide**: `aws-deployment/TROUBLESHOOTING.md`
3. **Run pre-deploy check**: `./aws-deployment/pre-deploy-check.sh`
4. **Check AWS Console** for instance status

---

## 🎉 What's Included

```
aws-deployment/
├── deploy.sh                    # Main deployment script ⭐
├── update.sh                    # Quick update script
├── setup-swap.sh                # Add swap memory
├── pre-deploy-check.sh          # Validation script
├── Dockerfile.production        # Production Docker image
├── docker-compose.production.yml # Docker Compose config
├── AWS_SETUP_GUIDE.md          # Complete guide
├── QUICK_REFERENCE.md          # Command cheat sheet
├── DEPLOYMENT_CHECKLIST.md     # Step-by-step checklist
├── ARCHITECTURE.md             # System diagrams
└── TROUBLESHOOTING.md          # Problem solving

.github/workflows/
└── deploy-to-ec2.yml           # Auto-deploy on push
```

---

## 🔄 Updating Your Backend

After making code changes:

```bash
# On your local machine
git push origin main

# On EC2 instance
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
cd /home/ubuntu/brainwave-backend
./update.sh
```

Or setup auto-deploy to do this automatically!

---

## 📊 Monitoring

```bash
# Check resource usage
docker stats

# Check disk space
df -h

# Check memory
free -h

# View logs
docker-compose -f aws-deployment/docker-compose.production.yml logs -f backend
```

---

## 🎓 Next Steps After Deployment

1. ✅ Test all API endpoints
2. ✅ Connect frontend to backend
3. ✅ Setup SSL with Let's Encrypt (optional)
4. ✅ Configure domain name (optional)
5. ✅ Setup monitoring and alerts
6. ✅ Create backup schedule
7. ✅ Document your configuration

---

**Ready to deploy?** Start with Step 1 above or read the [complete guide](aws-deployment/AWS_SETUP_GUIDE.md)!

**Questions?** Check the [troubleshooting guide](aws-deployment/TROUBLESHOOTING.md) or [quick reference](aws-deployment/QUICK_REFERENCE.md).
