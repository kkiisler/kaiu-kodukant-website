# API Backend Implementation Plan

**Project**: MTÜ Kaiu Kodukant - Node.js API Backend (TESTING)
**Environment**: Testing/Development
**Purpose**:
1. Handle form submissions (membership, contact)
2. Admin dashboard for viewing submissions
3. Monitor gallery & calendar sync status from S3
4. Replace Apps Script's "anyone" access requirement

**Note**: Simplified implementation for testing environment - no parallel operation, direct cutover when ready.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Host VM                           │
│                                                              │
│  ┌────────────────────┐       ┌──────────────────────────┐ │
│  │  Caddy Container   │       │   API Container          │ │
│  │  (Static Site)     │       │   (Node.js/Express)      │ │
│  │                    │       │                          │ │
│  │  Port 80/443       │       │   Port 3000 (internal)   │ │
│  └────────┬───────────┘       └──────────┬───────────────┘ │
│           │                              │                  │
│           │  Reverse Proxy               │                  │
│           │  api.kaiukodukant.ee ───────┘                  │
│           │  kaiukodukant.ee (static)                       │
│           │                                                 │
│           └──────────── Caddy Routes ────────────────────┐ │
│                                                           │ │
│           ┌───────────────────────────────────────────┐  │ │
│           │  Shared Volume: /data                     │  │ │
│           │  - forms.db (SQLite)                      │  │ │
│           │  - uploads/ (if needed)                   │  │ │
│           └───────────────────────────────────────────┘  │ │
│                                                           │ │
└───────────────────────────────────────────────────────────┘ │
                                                              │
            External: S3 (Pilvio) ←──────────────────────────┘
            - Read sync status
            - Read metadata/version.json
            - Read logs
```

---

## Project Structure

```
kaiumtu/
├── docker/
│   ├── docker-compose.yml           # Updated: add API service
│   ├── Caddyfile.prod              # Updated: add reverse proxy for api.kaiukodukant.ee
│   ├── deploy.sh                    # Updated: deploy both services
│   ├── Dockerfile                   # Existing (static site)
│   └── api/
│       └── Dockerfile               # NEW: Node.js API
├── api/                             # NEW: API backend code
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js                    # Express server entry point
│   ├── config/
│   │   └── index.js                 # Configuration (env vars)
│   ├── routes/
│   │   ├── forms.js                 # Form submission endpoints
│   │   ├── admin.js                 # Admin endpoints
│   │   └── monitoring.js            # S3 sync monitoring
│   ├── services/
│   │   ├── database.js              # SQLite setup
│   │   ├── email.js                 # Email notifications
│   │   ├── s3-client.js             # S3 monitoring client
│   │   └── recaptcha.js             # reCAPTCHA validation
│   ├── middleware/
│   │   ├── auth.js                  # Admin authentication
│   │   └── rate-limit.js            # Rate limiting
│   ├── views/                       # Admin dashboard HTML
│   │   ├── admin.html
│   │   ├── monitoring.html
│   │   └── assets/
│   │       ├── admin.css
│   │       └── admin.js
│   └── data/
│       └── .gitkeep                 # Placeholder (actual DB in volume)
├── js/
│   ├── config.js                    # Updated: add API_BASE_URL
│   └── forms.js                     # NEW: Form submission handler
└── [existing files...]
```

---

## Implementation Phases

### Phase 1: Node.js API Setup (2 hours)

#### 1.1 Create API Application
**Files to create**:
- `api/package.json` - Dependencies
- `api/server.js` - Express server
- `api/config/index.js` - Configuration
- `api/services/database.js` - SQLite setup

**Dependencies**:
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.2.2",
    "nodemailer": "^6.9.7",
    "axios": "^1.6.2",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5",
    "bcrypt": "^5.1.1",
    "dotenv": "^16.3.1"
  }
}
```

**Database Schema**:
```sql
CREATE TABLE membership_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  recaptcha_score REAL,
  ip_address TEXT,
  user_agent TEXT
);

CREATE TABLE contact_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  recaptcha_score REAL,
  ip_address TEXT,
  user_agent TEXT
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER DEFAULT 1,
  reset_at DATETIME
);

CREATE TABLE admin_sessions (
  token TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  ip_address TEXT
);
```

**Endpoints**:
```
POST   /api/v1/submit/membership     # Submit membership form
POST   /api/v1/submit/contact        # Submit contact form
POST   /api/v1/admin/login           # Admin login
GET    /api/v1/admin/submissions     # List all submissions
GET    /api/v1/admin/monitoring      # S3 sync status
DELETE /api/v1/admin/submission/:id  # Delete submission
GET    /api/v1/admin/export/csv      # Export to CSV
GET    /health                       # Health check
```

#### 1.2 Docker Configuration
**File**: `docker/api/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY api/package*.json ./
RUN npm ci --only=production

# Copy application code
COPY api/ ./

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "server.js"]
```

#### 1.3 Update docker-compose.yml
**Add API service**:
```yaml
services:
  web:
    # ... existing config ...
    depends_on:
      - api

  api:
    build:
      context: ../
      dockerfile: docker/api/Dockerfile
    container_name: kaiumtu-api
    restart: unless-stopped
    ports:
      - "3000:3000"  # Internal port
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_PATH=/data/forms.db
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - SMTP_FROM=${SMTP_FROM}
      - ADMIN_EMAIL=${ADMIN_EMAIL}
      - ADMIN_PASSWORD_HASH=${ADMIN_PASSWORD_HASH}
      - RECAPTCHA_SECRET_KEY=${RECAPTCHA_SECRET_KEY}
      - S3_ENDPOINT=https://s3.pilw.io
      - S3_BUCKET=kaiugalerii
      - S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
      - S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - api_data:/data
    networks:
      - web
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3

volumes:
  # ... existing volumes ...
  api_data:
    driver: local
```

#### 1.4 Update Caddyfile.prod
**Add reverse proxy for API**:
```caddyfile
# Main site
{$DOMAIN_NAME} {
    # ... existing config ...
}

# API subdomain
api.{$DOMAIN_NAME} {
    # Reverse proxy to API container
    reverse_proxy api:3000 {
        # Health check
        health_uri /health
        health_interval 10s
        health_timeout 3s

        # Headers
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }

    # CORS headers (if needed)
    header {
        Access-Control-Allow-Origin "https://{$DOMAIN_NAME}"
        Access-Control-Allow-Methods "GET, POST, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization"
        Access-Control-Allow-Credentials "true"
    }

    # Logging
    log {
        output file /var/log/caddy/api-access.log {
            roll_size 100mb
            roll_keep 5
        }
        format json
        level INFO
    }
}
```

---

### Phase 2: Form Handling (2 hours)

#### 2.1 Form Submission Endpoints
**Features**:
- reCAPTCHA v3 validation
- IP-based rate limiting (5 submissions/hour)
- Email-based rate limiting (1 submission/hour)
- Email notifications
- SQLite storage

**Flow**:
```
1. Frontend submits form → api.kaiukodukant.ee/api/v1/submit/membership
2. API validates reCAPTCHA token
3. API checks rate limits (IP + email)
4. API stores in SQLite
5. API sends email notification
6. API returns success/error JSON
```

#### 2.2 Update Frontend Forms
**Files to modify**:
- `membership.html` - Remove Apps Script form
- `contact.html` - Remove Apps Script form
- Create `js/forms.js` - Form handler

**New form handler**:
```javascript
// js/forms.js
class FormHandler {
  constructor(apiBaseUrl) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async submitMembership(formData) {
    // Get reCAPTCHA token
    const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, {
      action: 'membership'
    });

    // Submit to API
    const response = await fetch(`${this.apiBaseUrl}/api/v1/submit/membership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        recaptchaToken: token
      })
    });

    return response.json();
  }

  async submitContact(formData) {
    // Similar implementation
  }
}
```

---

### Phase 3: Admin Dashboard (2-3 hours)

#### 3.1 Admin Interface Features
**Pages**:
1. **Login** (`/admin/login`)
   - Simple password authentication
   - Session token (24h expiry)
   - Stored in localStorage

2. **Submissions** (`/admin/submissions`)
   - Table view of all submissions
   - Filter by type (membership/contact)
   - Sort by date
   - Search by name/email
   - Delete individual submissions
   - Export to CSV

3. **Monitoring** (`/admin/monitoring`) - OPTIONAL for testing
   - Basic S3 sync status display
   - Last sync times
   - Simple error log viewer
   - (Skip detailed dashboards for testing environment)

**UI Framework**: Vanilla HTML/CSS/JS (no framework, keep it simple)

#### 3.2 S3 Monitoring Integration
**What it shows**:
- Fetches `metadata/version.json` from S3
- Shows last update times for calendar & gallery
- Reads `logs/calendar-sync-*.json` for recent sync logs
- Reads `logs/gallery-sync-*.json` for recent sync logs
- Shows staleness warnings (if >60 min old)
- Displays sync errors/failures

**Endpoints**:
```
GET /api/v1/admin/monitoring/status
  → Returns: {
      calendar: {
        lastSync: "2024-10-01T14:30:00Z",
        status: "ok",
        staleness: 15  // minutes
      },
      gallery: {
        lastSync: "2024-10-01T14:25:00Z",
        status: "ok",
        staleness: 20
      },
      s3Storage: {
        used: "1.2 GB",
        objects: 650
      }
    }

GET /api/v1/admin/monitoring/logs?type=gallery&limit=10
  → Returns recent sync logs
```

---

### Phase 4: Email Configuration (30 minutes)

#### 4.1 SMTP Setup Options

**Option A: Use Gmail SMTP** (if you have Gmail)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=app-specific-password
SMTP_FROM=your-email@gmail.com
```

**Option B: Use Server's Mail** (if sendmail/postfix installed)
```
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_FROM=noreply@kaiukodukant.ee
```

**Option C: Use Mailgun/SendGrid** (free tier)
```
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@mg.yourdomain.com
SMTP_PASS=api-key
```

#### 4.2 Email Templates
Same format as Apps Script:
- **Subject**: "Uus liikmestaotus MTÜ Kaiu Kodukant" / "Uus sõnum kodulehelt"
- **To**: kaur.kiisler@gmail.com
- **Body**: All form fields + timestamp + reCAPTCHA score

---

### Phase 5: Deployment (1 hour)

#### 5.1 Environment Variables
**File**: `docker/.env` (update existing)

**Add to .env**:
```bash
# Existing
DOMAIN_NAME=kaiukodukant.ee
GOOGLE_APPS_SCRIPT_URL=...
RECAPTCHA_SITE_KEY=...

# NEW: API Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
ADMIN_EMAIL=kaur.kiisler@gmail.com

# Generate with: node -e "console.log(require('bcrypt').hashSync('your-password', 10))"
ADMIN_PASSWORD_HASH=$2b$10$...

# Generate with: openssl rand -base64 32
JWT_SECRET=your-random-secret-here

# From questionnaire
S3_ACCESS_KEY_ID=G1ZW8BDISGFYVG2SIKZ7
S3_SECRET_ACCESS_KEY=TEXyfkbNFK4Vff8YBxCS9onsuw9KQD0SLb31VQFO
```

#### 5.2 DNS Configuration
**Required DNS records**:
```
A     api.kaiukodukant.ee  →  YOUR_SERVER_IP
```

#### 5.3 Deploy
```bash
cd docker
./deploy.sh
```

**Deploy script will**:
1. Build both containers (web + api)
2. Start both services
3. Caddy will automatically get SSL certs for api.kaiukodukant.ee
4. Health checks verify both running

---

## Testing Checklist

### API Testing
- [ ] Health check responds: `curl https://api.kaiukodukant.ee/health`
- [ ] CORS headers present
- [ ] Rate limiting works
- [ ] reCAPTCHA validation works

### Form Testing
- [ ] Membership form submits successfully
- [ ] Contact form submits successfully
- [ ] Email notification received
- [ ] Data appears in SQLite
- [ ] Rate limiting prevents spam
- [ ] reCAPTCHA blocks bots

### Admin Testing
- [ ] Login works with password
- [ ] Submissions list loads
- [ ] Can filter/search submissions
- [ ] Can delete submissions
- [ ] CSV export works
- [ ] Monitoring shows S3 sync status
- [ ] Logs display correctly

---

## Security Considerations

### 1. Admin Authentication
- Simple password authentication (sufficient for single admin)
- Bcrypt-hashed password in env vars
- Session token with 24h expiry
- No user management needed

### 2. Rate Limiting
- IP-based: 5 submissions/hour
- Email-based: 1 submission/hour
- Admin endpoints: 100 requests/hour per IP

### 3. CORS
- Only allow requests from kaiukodukant.ee
- Admin interface: same-origin only

### 4. HTTPS
- Caddy handles SSL automatically
- Enforce HTTPS via HSTS headers

### 5. Input Validation
- Sanitize all form inputs
- Validate email format
- Limit message length (max 5000 chars)
- SQL injection protection (parameterized queries)

---

## Monitoring & Maintenance

### Daily
- Check if containers are running: `docker ps`
- Review logs: `docker logs kaiumtu-api`

### Weekly
- Check SQLite database size
- Review submission count
- Check email notifications working

### Monthly
- Backup SQLite database
- Review and delete old submissions (optional)
- Update dependencies: `npm audit fix`

---

## Migration from Apps Script (Simplified for Testing)

### Direct Cutover Strategy (Testing Environment)
1. Deploy API backend
2. Test API endpoints thoroughly
3. Update frontend to use API
4. Disable Apps Script doPost() endpoint
5. Keep Apps Script for sync functions only

**Note**: Since this is a testing environment, we skip parallel operation and go for direct cutover when ready.

---

## Questions for You

Before I generate all the code, please confirm:

### Q1: SMTP Configuration
**Which email option do you prefer?**
- [x] Gmail SMTP (I'll provide setup instructions)
- [ ] Server's built-in mail (sendmail/postfix)
- [ ] External service (Mailgun, SendGrid, etc.)
- [ ] Not sure - recommend best option

### Q2: Admin Password
**How should we set the admin password?**
- [x] I'll provide a password to hash
- [ ] Generate a random one for me
- [ ] I'll set it later in .env file

### Q3: Deployment Timing
**When do you want to deploy this?**
- [x] Add to S3 migration (Phase 4)
- [ ] Deploy separately after S3 migration complete
- [ ] Deploy ASAP before S3 migration

### Q4: Testing Strategy
**Parallel testing or direct cutover?**
- [ ] Run both systems for 1 week (recommended)
- [x] Direct cutover (faster but riskier)

### Q5: Data Retention
**How long to keep form submissions?**
- [] Keep forever
- [ ] Auto-delete after 1 year
- [x] Manual deletion only

---

## Next Steps

Once you answer the questions above, I will:

1. **Generate all API code files**:
   - Complete Node.js/Express application
   - Database setup and migrations
   - Admin dashboard (HTML/CSS/JS)
   - Email service
   - S3 monitoring client

2. **Update Docker configuration**:
   - docker-compose.yml with API service
   - Caddyfile with reverse proxy
   - API Dockerfile
   - Updated deploy.sh

3. **Update frontend**:
   - js/forms.js for form handling
   - js/config.js with API URLs
   - Update membership.html and contact.html

4. **Provide deployment guide**:
   - Step-by-step deployment instructions
   - Testing checklist
   - Troubleshooting guide

5. **Integration with S3 migration plan**:
   - Add as Phase 4 if you choose
   - Or keep as separate project

---

**Ready to proceed?** Please answer the 5 questions above and I'll generate all the code!
