# Application redundancy on EC2

The backend uses three recovery layers:

1. Gunicorn replaces a worker process when an individual worker crashes.
2. Docker restarts the container when the main process exits, while the systemd
   watchdog restarts a container that remains alive but fails readiness checks.
3. An Application Load Balancer removes an unhealthy target, and the Auto
   Scaling group replaces its EC2 instance when ELB health checks are enabled.

## Install the local watchdog

On every instance, or preferably in launch-template user data:

```bash
cd /home/ubuntu/brainwave-backend
chmod +x aws-deployment/setup-app-watchdog.sh
./aws-deployment/setup-app-watchdog.sh
```

Verify it:

```bash
systemctl status brainwave-app-watchdog.timer
curl --fail http://127.0.0.1:8000/api/health/ready
journalctl -t brainwave-watchdog --since "1 hour ago"
```

## Configure the ALB target group

- Protocol: HTTP
- Port: 8000
- Health-check path: `/api/health/ready`
- Success code: `200`
- Interval: 15 seconds
- Timeout: 5 seconds
- Healthy threshold: 2
- Unhealthy threshold: 2
- Deregistration delay: 30 seconds

The EC2 security group should allow port 8000 only from the ALB security group.
The ALB security group should expose only the public ports needed by clients.

## Configure the Auto Scaling group

- Attach the ALB target group.
- Turn on Elastic Load Balancing health checks.
- Set the health-check grace period to at least 180 seconds.
- Use at least two subnets in different Availability Zones.
- Set minimum capacity to 2, desired capacity to 2, and maximum capacity to the
  highest safe value for the database and downstream services.

With desired capacity 1, AWS can replace a failed app but there will still be
downtime while the replacement instance launches. Desired capacity 2 provides
actual request-serving redundancy.

## Make the application stateless before running two instances

Do not share SQLite or instance-local files between multiple backend instances.
Use:

- PostgreSQL/RDS or Supabase for `DATABASE_URL`
- S3 for uploads, attachments, and generated exports
- ElastiCache/Redis for shared queues, cache, locks, and WebSocket coordination
- A remote/shared vector store instead of instance-local ChromaDB
- Secrets Manager or SSM Parameter Store for production configuration

Without these changes, two healthy instances can serve different data or corrupt
state even though the load balancer itself works correctly.

## Failure test

1. Confirm two targets are healthy in the target group.
2. Stop the backend on one instance.
3. Confirm the ALB removes that target while requests continue on the other.
4. Confirm the watchdog restarts the container.
5. Stop it repeatedly and confirm the ASG eventually replaces the instance.
