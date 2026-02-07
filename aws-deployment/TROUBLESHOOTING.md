# 🔧 Troubleshooting Guide

Common issues and their solutions for AWS EC2 deployment.

## Connection Issues

### Can't SSH into EC2

**Symptoms:**
```bash
ssh: connect to host X.X.X.X port 22: Connection refused
# or
Permission denied (publickey)
```

**Solutions:**

1. **Check security group allows SSH from your IP:**
   - Go to EC2 → Security Groups
   - Ensure port 22 is open for your IP
   - Get your IP: `curl ifconfig.me`

2. **Check key file permissions:**
   ```bash
   chmod 400 your-key.pem
   ```

3. **Verify correct username:**
   ```bash
   # For Ubuntu AMI, use 'ubuntu'
   ssh -i your-key.pem ubuntu@YOUR_IP
   
   # NOT 'ec2-user' or 'root'
   ```

4. **Check instance is running:**
   - Go to EC2 console
   - Instance state should be "running"

### Can't Access Backend API from Outside

**Symptoms:**
```bash
curl: (7) Failed to connect to X.X.X.X port 8000: Connection refused
```

**Solutions:**

1. **Check security group allows port 8000:**
   ```bash
   # In AWS Console:
   # Security Groups → Inbound Rules → Add Rule
   # Type: Custom TCP
   # Port: 8000
   # Source: 0.0.0.0/0
   ```

2. **Verify backend is running:**
   ```bash
   docker ps
   # Should show brainwave-backend-prod
   ```

3. **Test locally first:**
   ```bash
   # SSH into EC2, then:
   curl http://localhost:8000/api/health
   ```

4. **Check if port is listening:**
   ```bash
   sudo netstat -tulpn | grep 8000
   ```

## Docker Issues

### Docker Command Not Found

**Symptoms:**
```bash
docker: command not found
```

**Solutions:**

1. **Install Docker:**
   ```bash
   ./deploy.sh
   # Script will install Docker automatically
   ```

2. **If already installed, add user to docker group:**
   ```bash
   sudo usermod -aG docker ubuntu
   # Log out and back in
   ```

### Container Won't Start

**Symptoms:**
```bash
docker ps
# Shows no containers or container keeps restarting
```

**Solutions:**

1. **Check logs:**
   ```bash
   docker-compose -f aws-deployment/docker-compose.production.yml logs backend
   ```

2. **Common issues in logs:**

   **Missing .env file:**
   ```bash
   # Create from example
   cp backend/.env.example backend/.env.production
   nano backend/.env.production
   ```

   **Port already in use:**
   ```bash
   # Find what's using port 8000
   sudo netstat -tulpn | grep 8000
   
   # Kill the process
   sudo kill -9 <PID>
   ```

   **Out of memory:**
   ```bash
   # Check memory
   free -h
   
   # Add swap if needed
   ./setup-swap.sh
   ```

3. **Rebuild container:**
   ```bash
   docker-compose -f aws-deployment/docker-compose.production.yml down
   docker-compose -f aws-deployment/docker-compose.production.yml build --no-cache
   docker-compose -f aws-deployment/docker-compose.production.yml up -d
   ```

### Container Exits Immediately

**Symptoms:**
```bash
docker ps -a
# Shows container with status "Exited (1)"
```

**Solutions:**

1. **Check logs for error:**
   ```bash
   docker logs brainwave-backend-prod
   ```

2. **Common errors:**

   **Import errors:**
   ```bash
   # Rebuild with fresh dependencies
   docker-compose -f aws-deployment/docker-compose.production.yml build --no-cache
   ```

   **Database errors:**
   ```bash
   # Check database file exists and has correct permissions
   ls -la backend/brainwave_tutor.db
   ```

   **Missing environment variables:**
   ```bash
   # Verify .env.production has all required variables
   cat backend/.env.production
   ```

## Application Issues

### Backend Returns 500 Errors

**Symptoms:**
```bash
curl http://localhost:8000/api/health
# Returns 500 Internal Server Error
```

**Solutions:**

1. **Check application logs:**
   ```bash
   docker-compose -f aws-deployment/docker-compose.production.yml logs -f backend
   ```

2. **Common causes:**

   **Missing API keys:**
   ```bash
   # Add to .env.production
   GOOGLE_GENERATIVE_AI_KEY=your-key-here
   ```

   **Database corruption:**
   ```bash
   # Backup and recreate
   docker exec brainwave-backend-prod cp /app/brainwave_tutor.db /app/exports/backup.db
   docker exec brainwave-backend-prod rm /app/brainwave_tutor.db
   docker-compose -f aws-deployment/docker-compose.production.yml restart backend
   ```

### AI Features Not Working

**Symptoms:**
- Chat returns errors
- Learning paths won't generate

**Solutions:**

1. **Verify API key:**
   ```bash
   # Check .env.production
   grep GOOGLE_GENERATIVE_AI_KEY backend/.env.production
   ```

2. **Test API key:**
   ```bash
   # SSH into container
   docker exec -it brainwave-backend-prod bash
   
   # Test in Python
   python3 -c "import google.generativeai as genai; genai.configure(api_key='YOUR_KEY'); print('OK')"
   ```

3. **Check API quota:**
   - Visit Google AI Studio
   - Check if you've hit rate limits

### File Uploads Failing

**Symptoms:**
- Upload returns 413 or 500 error
- Files not appearing

**Solutions:**

1. **Check upload directory permissions:**
   ```bash
   docker exec brainwave-backend-prod ls -la /app/uploads
   ```

2. **Check disk space:**
   ```bash
   df -h
   ```

3. **If using Nginx, increase client_max_body_size:**
   ```nginx
   # In /etc/nginx/sites-available/brainwave
   client_max_body_size 100M;
   ```

## Performance Issues

### High CPU Usage

**Symptoms:**
```bash
htop
# Shows 100% CPU usage
```

**Solutions:**

1. **Check what's using CPU:**
   ```bash
   docker stats
   ```

2. **If backend is using too much:**
   - Consider upgrading to t3.large
   - Reduce concurrent AI requests
   - Add caching (Redis)

3. **Restart container:**
   ```bash
   docker-compose -f aws-deployment/docker-compose.production.yml restart backend
   ```

### High Memory Usage

**Symptoms:**
```bash
free -h
# Shows very low available memory
```

**Solutions:**

1. **Add swap:**
   ```bash
   ./setup-swap.sh
   ```

2. **Reduce worker count:**
   ```dockerfile
   # In Dockerfile.production, change:
   CMD ["gunicorn", "main:app", "-w", "1", ...]
   # Instead of -w 2
   ```

3. **Upgrade instance:**
   - Stop instance
   - Change instance type to t3.medium or t3.large
   - Start instance

### Slow Response Times

**Symptoms:**
- API takes >5 seconds to respond
- Timeouts

**Solutions:**

1. **Check if AI calls are slow:**
   ```bash
   # Look for slow requests in logs
   docker-compose -f aws-deployment/docker-compose.production.yml logs backend | grep "took"
   ```

2. **Add Redis caching:**
   ```bash
   # Install Redis
   sudo apt-get install redis-server
   
   # Add to .env.production
   REDIS_URL=redis://localhost:6379
   ```

3. **Optimize database:**
   ```bash
   # If using SQLite, consider PostgreSQL for better performance
   ```

## Disk Space Issues

### Out of Disk Space

**Symptoms:**
```bash
df -h
# Shows 100% usage
```

**Solutions:**

1. **Clean Docker:**
   ```bash
   docker system prune -a
   # This removes unused images, containers, volumes
   ```

2. **Clean logs:**
   ```bash
   sudo journalctl --vacuum-time=3d
   ```

3. **Check large files:**
   ```bash
   du -h /home/ubuntu/brainwave-backend | sort -rh | head -20
   ```

4. **Increase EBS volume:**
   - Go to EC2 → Volumes
   - Modify volume size
   - Extend filesystem:
   ```bash
   sudo growpart /dev/xvda 1
   sudo resize2fs /dev/xvda1
   ```

## Deployment Issues

### Git Pull Fails

**Symptoms:**
```bash
git pull
# error: Your local changes would be overwritten
```

**Solutions:**

1. **Force reset to remote:**
   ```bash
   cd /home/ubuntu/brainwave-backend
   git fetch origin
   git reset --hard origin/main
   git pull origin main
   ```

2. **Or stash changes:**
   ```bash
   git stash
   git pull origin main
   ```

### Deploy Script Fails

**Symptoms:**
```bash
./deploy.sh
# Exits with error
```

**Solutions:**

1. **Check script permissions:**
   ```bash
   chmod +x deploy.sh
   ```

2. **Run with bash explicitly:**
   ```bash
   bash deploy.sh
   ```

3. **Check for syntax errors:**
   ```bash
   bash -n deploy.sh
   ```

4. **Run commands manually:**
   ```bash
   # Follow steps in deploy.sh one by one
   ```

## Network Issues

### Elastic IP Not Working

**Symptoms:**
- Can't connect to Elastic IP
- IP changed after restart

**Solutions:**

1. **Verify Elastic IP is associated:**
   - Go to EC2 → Elastic IPs
   - Check "Associated instance ID"

2. **Re-associate if needed:**
   - Select Elastic IP
   - Actions → Associate Elastic IP address
   - Select your instance

### DNS Not Resolving

**Symptoms:**
```bash
curl https://yourdomain.com
# Could not resolve host
```

**Solutions:**

1. **Check DNS records:**
   ```bash
   nslookup yourdomain.com
   # Should return your Elastic IP
   ```

2. **Update DNS A record:**
   - Go to your domain registrar
   - Set A record to your Elastic IP
   - Wait for propagation (up to 48 hours)

## Database Issues

### Database Locked

**Symptoms:**
```
sqlite3.OperationalError: database is locked
```

**Solutions:**

1. **Restart backend:**
   ```bash
   docker-compose -f aws-deployment/docker-compose.production.yml restart backend
   ```

2. **Check for multiple connections:**
   ```bash
   docker ps
   # Should only show one backend container
   ```

3. **Consider PostgreSQL:**
   - SQLite doesn't handle concurrent writes well
   - Migrate to PostgreSQL for production

### Database Corruption

**Symptoms:**
```
sqlite3.DatabaseError: database disk image is malformed
```

**Solutions:**

1. **Restore from backup:**
   ```bash
   docker exec brainwave-backend-prod cp /app/exports/backup.db /app/brainwave_tutor.db
   docker-compose -f aws-deployment/docker-compose.production.yml restart backend
   ```

2. **Try to repair:**
   ```bash
   docker exec -it brainwave-backend-prod bash
   sqlite3 brainwave_tutor.db "PRAGMA integrity_check;"
   ```

## Emergency Procedures

### Complete System Reset

```bash
# 1. Stop everything
docker-compose -f aws-deployment/docker-compose.production.yml down

# 2. Backup data
docker run --rm -v brainwave-backend_backend_uploads:/data -v $(pwd):/backup ubuntu tar czf /backup/uploads_backup.tar.gz /data

# 3. Remove all containers and volumes
docker system prune -a --volumes

# 4. Re-deploy
./deploy.sh
```

### Rollback to Previous Version

```bash
# 1. Check git history
git log --oneline

# 2. Checkout previous commit
git checkout <commit-hash>

# 3. Rebuild
docker-compose -f aws-deployment/docker-compose.production.yml up -d --build
```

### Instance Won't Start

1. **Check AWS Console for errors**
2. **Try stopping and starting (not rebooting)**
3. **Check if EBS volume is attached**
4. **Review system logs in AWS Console**

## Getting Help

### Collect Debug Information

```bash
# System info
uname -a
df -h
free -h

# Docker info
docker --version
docker-compose --version
docker ps -a
docker stats --no-stream

# Application logs
docker-compose -f aws-deployment/docker-compose.production.yml logs --tail=100 backend

# Network info
sudo netstat -tulpn
curl -v http://localhost:8000/api/health
```

### Where to Get Help

1. **Check logs first:**
   ```bash
   docker-compose -f aws-deployment/docker-compose.production.yml logs backend
   ```

2. **Search GitHub issues**

3. **AWS Support (if AWS-related)**

4. **Stack Overflow with collected debug info**

## Prevention

### Regular Maintenance

```bash
# Weekly
- Check disk space: df -h
- Check logs for errors
- Test backups
- Update system: sudo apt-get update && sudo apt-get upgrade

# Monthly
- Review security group rules
- Check AWS billing
- Update Docker images
- Review application logs for patterns
```

### Monitoring Setup

```bash
# Setup basic monitoring
watch -n 60 'docker stats --no-stream'

# Setup alerts (optional)
# Use CloudWatch or third-party monitoring
```
