# Deployment Guide for MTÜ Kaiu Kodukant Website

This guide covers deploying the website to a test VM using Docker and Caddy for automatic HTTPS.

## Prerequisites

- Linux VM (Ubuntu 20.04+ or Debian 11+ recommended)
- Docker and docker-compose installed
- Domain name pointing to your VM's IP address
- Ports 80 and 443 open in firewall

## Quick Start

### 1. Install Docker (if not already installed)

```bash
# Update package index
sudo apt update

# Install prerequisites
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

# Add Docker repository
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Install docker-compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone the Repository

```bash
git clone https://github.com/yourusername/kaiumtu.git
cd kaiumtu
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your actual values
nano .env
```

Set these values in `.env`:
```env
DOMAIN_NAME=test.kaiukodukant.ee  # Your test domain
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
```

### 4. Deploy with Docker Compose

#### Development/Testing (with live reload):
```bash
cd docker
docker-compose up -d
```

This will:
- Build the Docker image
- Start Caddy with automatic HTTPS
- Mount source files for live updates
- Expose ports 80 and 443

#### Production (Recommended - with build-time injection):
```bash
cd docker
# Use the production-specific compose file
./deploy-production.sh

# Or manually:
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

#### Production (Alternative):
```bash
cd docker
# Build the image first (important for environment variable injection)
docker-compose build --no-cache caddy-prod
# Then start the production container
docker-compose --profile production up -d caddy-prod
```

### 5. Verify Deployment

```bash
# Check if containers are running
docker ps

# View logs
docker-compose logs -f

# Test health endpoint
curl http://localhost:8080/health

# Test main site (replace with your domain)
curl https://test.kaiukodukant.ee
```

## Directory Structure

```
kaiumtu/
├── docker/
│   ├── Dockerfile          # Multi-stage build for static site
│   ├── docker-compose.yml  # Orchestration configuration
│   ├── Caddyfile          # Development Caddy config
│   └── Caddyfile.prod     # Production Caddy config
├── .env                    # Environment variables (create from .env.example)
├── *.html                  # Website pages
├── css/                    # Stylesheets
├── js/                     # JavaScript files
└── media/                  # Images and media
```

## Configuration Options

### Caddy Features

The included Caddy configuration provides:

1. **Automatic HTTPS** with Let's Encrypt certificates
2. **Security headers** (HSTS, CSP, etc.)
3. **Compression** (gzip and zstd)
4. **Caching** for static assets
5. **Custom error pages**
6. **Access logging**
7. **Health check endpoint**

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DOMAIN_NAME` | Your domain name | `test.kaiukodukant.ee` |
| `GOOGLE_APPS_SCRIPT_URL` | Google Apps Script backend URL | `https://script.google.com/...` |
| `RECAPTCHA_SITE_KEY` | reCAPTCHA v3 site key | `6Le...` |

## Maintenance

### Update the Website

```bash
# Pull latest changes
git pull

# Rebuild and restart containers
cd docker
docker-compose down
docker-compose up -d --build
```

### View Logs

```bash
# All logs
docker-compose logs -f

# Only Caddy logs
docker-compose logs -f web

# Access logs
docker exec kaiumtu-web cat /var/log/caddy/access.log
```

### Backup Certificates

Caddy stores certificates in Docker volumes:

```bash
# Backup certificates and config
docker run --rm -v kaiumtu_caddy_data:/data -v $(pwd):/backup alpine tar czf /backup/caddy_backup.tar.gz /data

# Restore certificates
docker run --rm -v kaiumtu_caddy_data:/data -v $(pwd):/backup alpine tar xzf /backup/caddy_backup.tar.gz -C /
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs web

# Check port availability
sudo netstat -tulpn | grep -E ':80|:443'

# Stop conflicting services
sudo systemctl stop nginx  # or apache2
```

### HTTPS not working

1. Ensure domain points to VM's IP:
   ```bash
   dig test.kaiukodukant.ee
   ```

2. Check firewall allows ports 80 and 443:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw status
   ```

3. Check Caddy logs for certificate errors:
   ```bash
   docker-compose logs web | grep -i cert
   ```

### Configuration not updating

```bash
# Rebuild with no cache
docker-compose build --no-cache
docker-compose up -d
```

### Environment variables not injecting into config.js

1. Ensure `.env` file exists in the `docker/` directory:
   ```bash
   cd docker
   cat .env  # Should show your variables
   ```

2. Rebuild the container (required for production):
   ```bash
   docker-compose build --no-cache caddy-prod
   docker-compose --profile production up -d caddy-prod
   ```

3. Verify injection worked:
   ```bash
   # Check if variables were replaced
   docker exec kaiumtu-caddy cat /usr/share/caddy/js/config.js
   # Should show actual URLs, not placeholders
   ```

### Permission issues

```bash
# Fix file permissions
sudo chown -R $USER:$USER .
chmod -R 755 .
```

## Security Considerations

1. **Keep Docker updated**: Regularly update Docker and base images
2. **Use secrets management**: Consider Docker secrets for sensitive data
3. **Regular backups**: Backup certificates and data regularly
4. **Monitor logs**: Set up log monitoring for security events
5. **Update dependencies**: Keep Caddy and Alpine Linux updated

## Alternative: Direct Caddy Installation (No Docker)

If you prefer not to use Docker:

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Copy website files
sudo cp -r * /var/www/html/

# Configure Caddy
sudo nano /etc/caddy/Caddyfile

# Restart Caddy
sudo systemctl reload caddy
```

## Support

For issues specific to:
- **Website functionality**: Check browser console for JavaScript errors
- **Google Apps Script**: Check execution logs in Apps Script editor
- **Caddy/HTTPS**: Check Caddy documentation at https://caddyserver.com/docs
- **Docker**: Check container logs with `docker-compose logs`

## Production Checklist

Before going to production:

- [ ] Configure production domain in `.env`
- [ ] Set up Google Apps Script with production URLs
- [ ] Configure reCAPTCHA for production domain
- [ ] Set up monitoring (e.g., UptimeRobot)
- [ ] Configure backups
- [ ] Test all forms and features
- [ ] Review security headers
- [ ] Set up log rotation
- [ ] Document emergency procedures

---

*Last updated: November 2024*