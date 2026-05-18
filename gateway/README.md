# Spiq Gateway - Production Deployment Guide

This is the OpenClaw Gateway that Spiq connects to for AI agent communication.

## Quick Start (Local Testing)

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
nano .env  # or your preferred editor

# Install dependencies
npm install

# Start server
npm start
```

Gateway runs on http://localhost:3333

## Production Deployment

### Option 1: Railway.app (Recommended - Easiest)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Deploy:**
   ```bash
   cd gateway
   railway init
   railway up
   ```

3. **Set Environment Variables:**
   ```bash
   railway variables set ANTHROPIC_API_KEY=sk-ant-your-key
   railway variables set OPENAI_API_KEY=sk-proj-your-key
   railway variables set ELEVENLABS_API_KEY=your-key
   railway variables set PORT=3333
   ```

4. **Get Your URL:**
   ```bash
   railway domain
   ```

   Your Gateway will be at: `https://your-app.railway.app`

**Cost:** ~$5-10/month

### Option 2: Render.com (Free Tier Available)

1. **Create Render Account:** https://render.com

2. **New Web Service:**
   - Connect your GitHub repo
   - Root directory: `gateway`
   - Build command: `npm install`
   - Start command: `npm start`

3. **Environment Variables:**
   - Add `ANTHROPIC_API_KEY`
   - Add `OPENAI_API_KEY`
   - Add `ELEVENLABS_API_KEY`
   - Add `PORT` = 3333

4. **Deploy**

   Your Gateway will be at: `https://your-service.onrender.com`

**Cost:** Free tier available, $7/month for production

### Option 3: Fly.io (Free Tier Available)

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. **Deploy:**
   ```bash
   cd gateway
   fly launch
   ```

3. **Set Secrets:**
   ```bash
   fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key
   fly secrets set OPENAI_API_KEY=sk-proj-your-key
   fly secrets set ELEVENLABS_API_KEY=your-key
   ```

   Your Gateway will be at: `https://your-app.fly.dev`

**Cost:** Free tier available

### Option 4: AWS EC2 (Most Control)

1. **Launch EC2 Instance:**
   - Ubuntu 22.04 LTS
   - t2.micro (free tier eligible)
   - Open port 3333 in security group

2. **SSH and Setup:**
   ```bash
   ssh ubuntu@your-ec2-ip

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Clone repo
   git clone https://github.com/your-org/spiq.git
   cd spiq/gateway

   # Install dependencies
   npm install

   # Set up environment
   cp .env.example .env
   nano .env  # Add your keys
   ```

3. **Set up PM2 (Process Manager):**
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name spiq-gateway
   pm2 startup
   pm2 save
   ```

4. **Set up Nginx (HTTPS):**
   ```bash
   sudo apt-get install -y nginx certbot python3-certbot-nginx

   # Configure Nginx (see nginx.conf below)
   sudo nano /etc/nginx/sites-available/spiq-gateway

   # Get SSL certificate
   sudo certbot --nginx -d your-domain.com
   ```

   Your Gateway will be at: `https://your-domain.com`

**Cost:** ~$5-10/month (t2.micro free tier for 12 months)

## Nginx Configuration (for AWS/VPS)

Create `/etc/nginx/sites-available/spiq-gateway`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/spiq-gateway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Environment Variables

Required:
- `ANTHROPIC_API_KEY` - Your Anthropic API key (for Claude)
- `OPENAI_API_KEY` - Your OpenAI API key (for Realtime voice)

Optional:
- `ELEVENLABS_API_KEY` - For enhanced TTS (optional)
- `PORT` - Server port (default: 3333)

## Security Checklist

- [ ] API keys stored in environment variables (not hardcoded)
- [ ] HTTPS enabled (required for production)
- [ ] Firewall configured (only allow HTTPS traffic)
- [ ] Rate limiting configured
- [ ] CORS configured with specific origins
- [ ] Regular security updates scheduled

## Monitoring

Add basic monitoring:

```bash
# Check if server is running
curl https://your-gateway.com/health

# Check logs (Railway)
railway logs

# Check logs (Render)
# View in dashboard

# Check logs (Fly)
fly logs

# Check logs (PM2)
pm2 logs spiq-gateway
```

## Troubleshooting

**Gateway not responding:**
- Check if process is running
- Check firewall rules
- Verify environment variables are set
- Check logs for errors

**API errors:**
- Verify API keys are correct
- Check API key quotas
- Ensure keys have required permissions

**CORS errors from mobile app:**
- Update CORS configuration in server.js
- Add your app's origin to allowed origins

## Scaling

For high traffic:
1. Use a load balancer
2. Deploy multiple instances
3. Use Redis for session storage
4. Enable caching (CDN)
5. Monitor with Datadog/New Relic

## Cost Estimates

| Platform | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| Railway | No | $5-10/mo | Easy deployment |
| Render | Yes | $7/mo | Free start |
| Fly.io | Yes | ~$5/mo | Free start |
| AWS EC2 | 12 months | $5-10/mo | Full control |

## Support

For Gateway deployment issues:
- Check logs first
- Review environment variables
- Test locally before deploying
- Open issue on GitHub

---

Choose the deployment option that fits your needs and follow the steps above!
