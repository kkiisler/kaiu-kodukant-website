# API Backend Deployment Guide

This guide covers the deployment of the new Node.js API backend for MTÜ Kaiu Kodukant website, which handles form submissions and provides an admin dashboard.

## Prerequisites

- Docker and Docker Compose installed on your server
- DNS A record for `api.kaiukodukant.ee` pointing to your server
- SMTP credentials for email notifications
- S3 credentials (already configured from Phase 1 & 2)

## Quick Start

### 1. Copy Environment Configuration

```bash
cd docker
cp .env.example .env
nano .env
```

### 2. Configure Required Values

Edit `.env` and set the following:

#### Essential Configuration

```env
# Your domain
DOMAIN_NAME=kaiukodukant.ee

# reCAPTCHA (get from https://www.google.com/recaptcha/admin)
RECAPTCHA_SITE_KEY=your_site_key_here
RECAPTCHA_SECRET_KEY=your_secret_key_here

# Admin email (receives notifications)
ADMIN_EMAIL=kaur.kiisler@gmail.com
```

#### Email Configuration (Gmail Example)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASS=your-app-specific-password  # Generate at myaccount.google.com/apppasswords
SMTP_FROM=your.email@gmail.com
```

#### Admin Password

Generate a hashed password:

```bash
# Option 1: Using Node.js directly
node -e "console.log(require('bcrypt').hashSync('your-password', 10))"

# Option 2: Using the API container
docker run --rm -it node:20-alpine sh -c "npm install bcrypt && node -e \"console.log(require('bcrypt').hashSync('your-password', 10))\""
```

Set in `.env`:
```env
ADMIN_PASSWORD_HASH=$2b$10$...your-hash-here...
```

#### JWT Secret

Generate a secure random secret:

```bash
openssl rand -base64 32
```

Set in `.env`:
```env
JWT_SECRET=your-generated-secret-here
```

#### S3 Configuration (from Phase 1 & 2)

```env
S3_ACCESS_KEY_ID=G1ZW8BDISGFYVG2SIKZ7
S3_SECRET_ACCESS_KEY=TEXyfkbNFK4Vff8YBxCS9onsuw9KQD0SLb31VQFO
```

### 3. Deploy the API Backend

```bash
# Pull latest changes
git pull

# Build and start containers
cd docker
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f api
```

### 4. Update Frontend Forms

The forms should automatically use the new API if configured. To switch forms to use the API:

1. Edit `pages/membership.html` and `pages/contact.html`
2. Change the script source from `forms.js` to `forms-api.js`:

```html
<!-- Old -->
<script src="/js/forms.js"></script>

<!-- New -->
<script src="/js/forms-api.js"></script>
```

Or update `js/config.js` to enable API:

```javascript
window.API_BASE_URL = 'https://api.kaiukodukant.ee';
```

### 5. Test the Deployment

#### Test API Health

```bash
curl https://api.kaiukodukant.ee/health
```

Should return:
```json
{"status":"healthy","timestamp":"...","uptime":...}
```

#### Test Admin Dashboard

1. Navigate to: https://api.kaiukodukant.ee/admin
2. Login with your configured password
3. You should see the admin dashboard

#### Test Form Submission

1. Go to https://kaiukodukant.ee/membership
2. Fill out the form
3. Submit and verify:
   - Success message appears
   - Email notification received
   - Submission appears in admin dashboard

## Admin Dashboard Features

### Access the Dashboard

URL: https://api.kaiukodukant.ee/admin

Features:
- View all form submissions
- Filter by type (membership/contact)
- Delete submissions
- Export to CSV
- View statistics
- Monitor S3 sync status

### Admin Operations

#### View Submissions
- All submissions are listed with details
- Click "Vaata" to view full message content
- Use filters to show only membership or contact forms

#### Export Data
- Click "Ekspordi CSV" to download submissions
- Useful for backing up or analyzing data

#### Monitoring
- Click "Monitooring" to view S3 sync status
- Shows last sync times for calendar and gallery
- Displays any sync errors

## Maintenance

### View Logs

```bash
# API logs
docker-compose logs -f api

# All logs
docker-compose logs -f
```

### Backup Database

The SQLite database is stored in a Docker volume. To backup:

```bash
# Create backup
docker run --rm -v kaiumtu_api_data:/data alpine tar czf - /data > api_backup_$(date +%Y%m%d).tar.gz

# Restore backup
docker run --rm -i -v kaiumtu_api_data:/data alpine tar xzf - < api_backup_20241001.tar.gz
```

### Update the API

```bash
# Pull latest changes
git pull

# Rebuild and restart
cd docker
docker-compose up -d --build api

# Check status
docker-compose ps
```

### Run Maintenance

Clean up old sessions and rate limits:

```bash
# Via admin dashboard
curl -X POST https://api.kaiukodukant.ee/api/v1/admin/maintenance \
  -H "Authorization: Bearer YOUR_TOKEN"

# Or from admin UI: Click "Käivita hooldus"
```

## Troubleshooting

### API Not Accessible

1. Check if container is running:
```bash
docker-compose ps
```

2. Check logs for errors:
```bash
docker-compose logs api
```

3. Verify DNS record:
```bash
nslookup api.kaiukodukant.ee
```

### Forms Not Submitting

1. Check browser console for errors
2. Verify reCAPTCHA is configured correctly
3. Check API logs for validation errors
4. Test API directly:

```bash
curl -X POST https://api.kaiukodukant.ee/api/v1/submit/membership \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com"}'
```

### Email Notifications Not Sent

1. Verify SMTP configuration in `.env`
2. Test email from admin dashboard (click "Test email")
3. Check API logs for email errors
4. For Gmail, ensure:
   - 2-factor authentication is enabled
   - App-specific password is used
   - Less secure app access is NOT needed

### Database Issues

Reset database (WARNING: deletes all data):

```bash
# Stop API
docker-compose stop api

# Remove data volume
docker volume rm kaiumtu_api_data

# Restart API (creates fresh database)
docker-compose up -d api
```

## Security Considerations

1. **Admin Password**: Use a strong, unique password
2. **JWT Secret**: Keep it secret, rotate periodically
3. **HTTPS Only**: Caddy automatically handles SSL
4. **Rate Limiting**: Built-in protection against spam
5. **Database Backups**: Regular backups recommended

## Monitoring

### Check API Status

```bash
# Health check
curl https://api.kaiukodukant.ee/health

# Statistics (requires auth)
curl https://api.kaiukodukant.ee/api/v1/admin/statistics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Monitor Resources

```bash
# Container stats
docker stats kaiumtu-api

# Disk usage
docker system df
```

## Rollback Plan

If you need to revert to Google Apps Script forms:

1. Edit `pages/membership.html` and `pages/contact.html`
2. Change script back to original:
```html
<script src="/js/forms.js"></script>
```

3. Stop API container (optional):
```bash
docker-compose stop api
```

The old Google Apps Script backend will continue working as before.

## Support

For issues or questions:
1. Check logs: `docker-compose logs api`
2. Review this documentation
3. Contact system administrator

## Next Steps

After successful deployment:
1. ✅ Test all form submissions
2. ✅ Verify email notifications
3. ✅ Check admin dashboard access
4. ✅ Monitor for 24 hours
5. ✅ Schedule regular database backups
6. ✅ Document admin password securely

---

**Deployment Checklist**:
- [ ] DNS record created for api.kaiukodukant.ee
- [ ] Environment variables configured
- [ ] Admin password generated and saved
- [ ] API container running
- [ ] Health check passing
- [ ] Admin dashboard accessible
- [ ] Form submissions working
- [ ] Email notifications received
- [ ] Database backup scheduled