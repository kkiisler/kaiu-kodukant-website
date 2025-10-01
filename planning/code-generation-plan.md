# Code Generation Plan

**Project**: MTÜ Kaiu Kodukant - Complete Migration Implementation (TESTING)
**Environment**: Testing/Development
**Date**: 2025-10-01
**Status**: READY TO GENERATE
**Critical Update**: Gallery sync MUST include resumable batch processing
**Timeline**: 2 weeks (simplified for testing)

---

## Overview

This document outlines what code will be generated and where it will be placed.

**IMPORTANT**: Before code generation, repository will be restructured (see `repository-restructuring-plan.md`)

---

## Directory Structure (After Generation)

```
kaiumtu/
├── pages/                             # RESTRUCTURED: All HTML pages
│   ├── index.html                     # UPDATED
│   ├── about.html                     # UPDATED
│   ├── events.html                    # UPDATED
│   ├── gallery.html                   # UPDATED
│   ├── membership.html                # UPDATED
│   └── contact.html                   # UPDATED
│
├── apps-script/                       # NEW: Google Apps Script files
│   ├── README.md
│   ├── SETUP-GUIDE.md
│   ├── config.gs
│   ├── s3-utils.gs
│   ├── calendar-sync.gs
│   ├── gallery-sync.gs
│   ├── image-processor.gs
│   ├── monitoring.gs
│   ├── Code.gs
│   └── triggers-setup.gs
│
├── api/                               # NEW: Node.js API Backend
│   ├── package.json
│   ├── .env.example
│   ├── server.js
│   ├── config/
│   │   └── index.js
│   ├── routes/
│   │   ├── forms.js
│   │   ├── admin.js
│   │   └── monitoring.js
│   ├── services/
│   │   ├── database.js
│   │   ├── email.js
│   │   ├── s3-client.js
│   │   └── recaptcha.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── rate-limit.js
│   │   └── validate.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── password.js
│   └── views/
│       ├── admin.html
│       ├── login.html
│       └── assets/
│           ├── admin.css
│           └── admin.js
│
├── docker/
│   ├── docker-compose.yml             # UPDATED
│   ├── Caddyfile.prod                 # UPDATED
│   ├── deploy.sh                      # UPDATED
│   ├── .env.example                   # UPDATED
│   ├── Dockerfile                     # UPDATED (pages/ copy)
│   └── api/
│       └── Dockerfile                 # NEW
│
├── js/
│   ├── config.js                      # UPDATED
│   ├── forms.js                       # NEW
│   ├── calendar.js                    # UPDATED
│   └── gallery.js                     # UPDATED
│
├── css/                               # EXISTING (no changes)
├── media/                             # EXISTING (no changes)
│
├── archive/
│   ├── index_original.html            # MOVED from root
│   ├── tests/                         # NEW: Archived test files
│   │   ├── test-calendar.html
│   │   ├── test-gallery.html
│   │   ├── test-lightbox.html
│   │   └── test-recaptcha.html
│   └── [existing archives...]
│
├── planning/                          # Plans and documentation only
│   ├── DEPLOYMENT-GUIDE.md            # NEW
│   ├── TESTING-GUIDE.md               # NEW
│   ├── TROUBLESHOOTING.md             # NEW
│   ├── repository-restructuring-plan.md  # EXISTING
│   └── [existing plan files...]
│
└── [other existing files...]
```

---

## Code Generation Breakdown

### Phase 0: Repository Restructuring (PREREQUISITE)

**See**: `repository-restructuring-plan.md`

**Tasks**:
- [x] Create `pages/` folder
- [x] Move HTML files to `pages/`
- [x] Archive test files to `archive/tests/`
- [x] Update Dockerfile to copy from `pages/`
- [x] Update Caddyfile with URL rewrites
- [x] Update HTML internal links to absolute paths
- [x] Update CSS/JS/media paths in HTML

**Duration**: ~30 minutes
**Status**: Must be completed before code generation

---

### 1. Apps Script Files (`apps-script/`)

**Location**: Project root `/apps-script/`

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| `README.md` | Overview and quick start | ~100 | Simple |
| `SETUP-GUIDE.md` | Step-by-step setup instructions | ~200 | Simple |
| `config.gs` | Configuration (Script Properties) | ~50 | Simple |
| `s3-utils.gs` | S3 upload/download, AWS Signature V4 | ~300 | Complex |
| `calendar-sync.gs` | Calendar → S3 sync logic | ~200 | Medium |
| `gallery-sync.gs` | **CRITICAL: Resumable batch processing (50 images/run)** | ~350 | High |
| `image-processor.gs` | Image handling from Drive | ~150 | Medium |
| `monitoring.gs` | Error tracking, email alerts | ~150 | Medium |
| `Code.gs` | Entry points, manual functions | ~100 | Simple |
| `triggers-setup.gs` | Trigger creation helper | ~50 | Simple |

**Total**: ~1,550 lines

**Key Features**:
- AWS Signature V4 authentication for S3
- Smart sync (only when Drive changes)
- **CRITICAL: Resumable batch processing (50 images per 6-min run)**
  - State persistence in Script Properties
  - Automatic continuation on next trigger
  - Handles 200+ photos without timeout
- Email alerts on failures
- Comprehensive error handling
- Progress tracking for long operations

---

### 2. API Backend (`api/`)

**Location**: Project root `/api/`

#### 2.1 Core Files

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| `package.json` | Dependencies & scripts | ~50 | Simple |
| `.env.example` | Environment variables template | ~30 | Simple |
| `server.js` | Express server entry point | ~100 | Medium |

#### 2.2 Configuration

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| `config/index.js` | Load and validate env vars | ~80 | Simple |

#### 2.3 Routes

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| `routes/forms.js` | Form submission endpoints | ~200 | Medium |
| `routes/admin.js` | Admin CRUD operations | ~250 | Medium |
| `routes/monitoring.js` | S3 sync monitoring | ~150 | Medium |

#### 2.4 Services

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| `services/database.js` | SQLite setup, migrations, queries | ~300 | Medium |
| `services/email.js` | Email notifications (nodemailer) | ~150 | Simple |
| `services/s3-client.js` | S3 monitoring client | ~200 | Medium |
| `services/recaptcha.js` | reCAPTCHA validation | ~80 | Simple |

#### 2.5 Middleware

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| `middleware/auth.js` | JWT authentication | ~100 | Medium |
| `middleware/rate-limit.js` | Rate limiting logic | ~100 | Medium |
| `middleware/validate.js` | Input validation schemas | ~150 | Simple |

#### 2.6 Utilities

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| `utils/logger.js` | Logging utility | ~50 | Simple |
| `utils/password.js` | Password hashing helper | ~30 | Simple |

#### 2.7 Views (Admin Dashboard)

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| `views/admin.html` | Admin dashboard layout | ~200 | Medium |
| `views/login.html` | Login page | ~80 | Simple |
| `views/assets/admin.css` | Dashboard styles | ~300 | Simple |
| `views/assets/admin.js` | Dashboard interactivity | ~400 | Medium |

**Total API**: ~2,980 lines

**Key Features**:
- RESTful API design
- JWT authentication
- Rate limiting (IP + email based)
- SQLite with prepared statements
- Email notifications via SMTP
- S3 monitoring integration
- CSV export functionality
- Comprehensive input validation
- Error handling & logging

---

### 3. Docker Configuration Updates

**Location**: `/docker/`

| File | Type | Changes |
|------|------|---------|
| `docker-compose.yml` | UPDATED | Add `api` service, shared volume |
| `Caddyfile.prod` | UPDATED | Add reverse proxy for `api.kaiukodukant.ee` + URL rewrites for `pages/` |
| `deploy.sh` | UPDATED | Deploy both web + API containers |
| `.env.example` | UPDATED | Add API environment variables |
| `Dockerfile` | UPDATED | Copy from `pages/` instead of `*.html` |
| `api/Dockerfile` | NEW | Node.js 20 Alpine, multi-stage build |

**Total Docker**: ~200 lines updated + ~30 lines new

---

### 4. Frontend Updates

**Location**: Project root

| File | Type | Changes |
|------|------|---------|
| `pages/index.html` | UPDATED | Links to absolute paths (`/about` not `about.html`) |
| `pages/about.html` | UPDATED | Links to absolute paths, CSS/JS paths |
| `pages/events.html` | UPDATED | Links + fetch from S3 (calendar) |
| `pages/gallery.html` | UPDATED | Links + fetch from S3 (gallery) |
| `pages/membership.html` | UPDATED | Links + use new form handler |
| `pages/contact.html` | UPDATED | Links + use new form handler |
| `js/config.js` | UPDATED | Add `API_BASE_URL`, `S3_CONFIG` |
| `js/forms.js` | NEW | Form submission handler (~200 lines) |
| `js/calendar.js` | UPDATED | Fetch from S3 instead of Apps Script |
| `js/gallery.js` | UPDATED | Fetch from S3 instead of Apps Script |

**Total Frontend**: ~600 lines updated + ~200 lines new

**Key Updates**:
- All navigation links: `/about` instead of `about.html`
- All CSS links: `/css/...` (absolute)
- All JS links: `/js/...` (absolute)
- All images: `/media/...` (absolute)
- Forms submit to API instead of Apps Script
- Calendar/Gallery fetch from S3

---

### 5. Documentation

**Location**: `/planning/`

| File | Purpose | Lines |
|------|---------|-------|
| `DEPLOYMENT-GUIDE.md` | Complete deployment walkthrough | ~400 |
| `TESTING-GUIDE.md` | Testing procedures for each component | ~300 |
| `TROUBLESHOOTING.md` | Common issues & solutions | ~200 |

**Total Documentation**: ~900 lines

---

## Total Code Statistics

| Category | Files | Lines of Code | Complexity |
|----------|-------|---------------|------------|
| Apps Script | 10 | ~1,550 | Medium-High |
| API Backend | 19 | ~2,980 | Medium-High |
| Docker Config | 6 | ~230 | Low-Medium |
| Frontend | 10 | ~800 | Low-Medium |
| Documentation | 3 | ~900 | Low |
| **TOTAL** | **48** | **~6,460** | **Medium** |

---

## Generation Order

### Phase 0: Repository Restructuring (MANUAL - 30 min)
**Status**: Must be done BEFORE code generation
**See**: `repository-restructuring-plan.md`

---

### Phase 1: Apps Script (Priority: HIGH)
**Reason**: Needed for S3 sync, independent of other components

**Generate**:
1. `apps-script/s3-utils.gs` (foundation for all sync)
2. `apps-script/config.gs` (configuration)
3. `apps-script/calendar-sync.gs` (simpler, test first)
4. `apps-script/gallery-sync.gs` (more complex)
5. `apps-script/image-processor.gs` (supporting)
6. `apps-script/monitoring.gs` (error handling)
7. `apps-script/Code.gs` (entry points)
8. `apps-script/triggers-setup.gs` (helper)
9. `apps-script/README.md` (documentation)
10. `apps-script/SETUP-GUIDE.md` (documentation)

---

### Phase 2: API Backend (Priority: HIGH)
**Reason**: Needed for form handling, independent of S3

**Generate in order**:
1. `api/package.json` (dependencies first)
2. `api/.env.example` (configuration template)
3. `api/config/index.js` (configuration loader)
4. `api/services/database.js` (foundation)
5. `api/services/recaptcha.js` (validation)
6. `api/services/email.js` (notifications)
7. `api/services/s3-client.js` (monitoring)
8. `api/middleware/*.js` (all middleware)
9. `api/utils/*.js` (utilities)
10. `api/routes/*.js` (all routes)
11. `api/server.js` (entry point)
12. `api/views/*.html` (admin UI)
13. `api/views/assets/*.css` (styles)
14. `api/views/assets/*.js` (JavaScript)

---

### Phase 3: Docker Configuration (Priority: MEDIUM)
**Reason**: Needed for deployment, depends on API structure

**Generate**:
1. `docker/api/Dockerfile`
2. Update `docker/docker-compose.yml`
3. Update `docker/Caddyfile.prod`
4. Update `docker/deploy.sh`
5. Update `docker/.env.example`
6. Update `docker/Dockerfile` (pages/ copy)

---

### Phase 4: Frontend Updates (Priority: MEDIUM)
**Reason**: Depends on API and S3 being ready

**Generate**:
1. Update all HTML files in `pages/` (links, paths)
2. Update `js/config.js`
3. Create `js/forms.js`
4. Update `js/calendar.js`
5. Update `js/gallery.js`

---

### Phase 5: Documentation (Priority: LOW)
**Reason**: Can be done last, all code ready

**Generate**:
1. `planning/DEPLOYMENT-GUIDE.md`
2. `planning/TESTING-GUIDE.md`
3. `planning/TROUBLESHOOTING.md`

---

## Dependencies Between Components

```
Repository Restructuring (PHASE 0 - MANUAL)
    ↓
Apps Script (S3 Sync)
    ↓
S3 Storage (Pilvio)
    ↓
Frontend (Calendar/Gallery) ──→ Reads from S3
    ↓
API Backend (Forms)
    ↓
Admin Dashboard ──→ Monitors S3 + Shows Forms
```

**Independent components**:
- Apps Script can be deployed separately
- API can be deployed separately
- Frontend can be updated independently

**Dependent components**:
- Frontend calendar.js requires S3 to have data
- Frontend gallery.js requires S3 to have data
- Admin monitoring requires S3 logs

---

## Environment Variables Required

### Apps Script (Script Properties)
```
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
ADMIN_EMAIL (for alerts)
```

### API Backend (.env)
```
# Database
DATABASE_PATH=/data/forms.db

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# Admin
ADMIN_EMAIL=kaur.kiisler@gmail.com
ADMIN_PASSWORD_HASH=$2b$10$...
JWT_SECRET=random-secret-here

# reCAPTCHA
RECAPTCHA_SECRET_KEY=your-secret-key

# S3 (for monitoring)
S3_ENDPOINT=https://s3.pilw.io
S3_BUCKET=kaiugalerii
S3_ACCESS_KEY_ID=G1ZW8BDISGFYVG2SIKZ7
S3_SECRET_ACCESS_KEY=TEXyfkbNFK4Vff8YBxCS9onsuw9KQD0SLb31VQFO

# Node
NODE_ENV=production
PORT=3000
```

### Docker (.env)
```
DOMAIN_NAME=kaiukodukant.ee
GOOGLE_APPS_SCRIPT_URL=... (legacy, will be removed)
RECAPTCHA_SITE_KEY=...
[All API env vars above]
```

---

## Pre-Generation Checklist

Before generating code, confirm:

- [x] S3 questionnaire answered (s3-migration-questionnaire.md)
- [x] API questionnaire answered (api-backend-plan.md)
- [x] Planning folder cleaned up
- [x] Project structure decided (apps-script/ in root, api/ in root)
- [x] Repository restructuring plan created
- [x] Gmail SMTP chosen for email
- [x] Admin password will be provided for hashing
- [x] Direct cutover migration strategy
- [x] Manual data retention
- [ ] **Phase 0 completed** (HTML files moved to pages/)

---

## Post-Generation Tasks (User)

### 0. Repository Restructuring (DO FIRST)
See `repository-restructuring-plan.md`
- [ ] Create `pages/` folder
- [ ] Move HTML files
- [ ] Archive test files
- [ ] Update Docker configuration
- [ ] Test locally

### 1. Apps Script Setup
- [ ] Create new Google Apps Script project
- [ ] Copy all `.gs` files from `apps-script/` folder
- [ ] Add Script Properties (credentials)
- [ ] Enable Advanced Drive API
- [ ] Test manual sync functions
- [ ] Create time-based triggers

### 2. API Backend Setup
- [ ] Run `npm install` in `api/` directory
- [ ] Generate admin password hash
- [ ] Create `docker/.env` with all credentials
- [ ] Review API configuration

### 3. DNS Setup
- [ ] Add DNS A record: `api.kaiukodukant.ee` → server IP

### 4. Deployment
- [ ] Run `cd docker && ./deploy.sh`
- [ ] Verify both containers running
- [ ] Check SSL certificates obtained

### 5. Testing
- [ ] Test Apps Script manual sync
- [ ] Test API health endpoint
- [ ] Test form submissions
- [ ] Test admin dashboard login
- [ ] Verify S3 monitoring
- [ ] Test all page URLs
- [ ] Test navigation links

---

## Risk Mitigation

### Code Quality
- ✅ Comprehensive error handling in all files
- ✅ Input validation on all endpoints
- ✅ Prepared statements (SQL injection prevention)
- ✅ Rate limiting to prevent abuse
- ✅ Logging for debugging

### Testing
- ✅ Each component can be tested independently
- ✅ Manual sync functions for Apps Script
- ✅ Health checks for API
- ✅ Admin dashboard for monitoring

### Rollback
- ✅ Old `apps-script-backend.js` untouched
- ✅ Can disable triggers if needed
- ✅ Can stop API container independently
- ✅ Frontend can be reverted via git
- ✅ Repository restructuring can be reverted

---

## Success Criteria

After code generation and deployment:

### Repository Structure
- [ ] Clean root directory (only folders)
- [ ] All HTML in `pages/`
- [ ] Clean URLs working (`/about` not `/about.html`)

### Apps Script
- [ ] Calendar syncs to S3 every 5 minutes
- [ ] Gallery syncs to S3 every 15 minutes
- [ ] No "anyone" access required
- [ ] Email alerts on failures

### API Backend
- [ ] Forms submit successfully
- [ ] Email notifications sent
- [ ] Data stored in SQLite
- [ ] Rate limiting working
- [ ] Admin dashboard accessible

### Frontend
- [ ] Calendar loads from S3
- [ ] Gallery loads from S3
- [ ] Forms submit to API
- [ ] No Apps Script dependencies
- [ ] All navigation works
- [ ] CSS/JS/images load correctly

### Performance
- [ ] Calendar loads <1s
- [ ] Gallery loads <2s
- [ ] Form submission <500ms
- [ ] Admin dashboard responsive

---

## Estimated Timeline (Testing Environment - 2 Weeks)

### Week 1
| Day | Task | Duration |
|-----|------|----------|
| **1** | **Repository Restructuring** | **2-3 hours** |
| **1-2** | Calendar Migration (Apps Script + Frontend) | **4-5 hours** |
| **3-5** | Gallery Migration with Batch Processing | **8-10 hours** |

### Week 2
| Day | Task | Duration |
|-----|------|----------|
| **1-3** | API Backend Implementation | **10-12 hours** |
| **4** | Forms Migration to API | **4-5 hours** |
| **5** | Testing & Direct Cutover | **6-8 hours** |

**Total**: ~35-45 hours over 2 weeks

**Critical Path**: Gallery batch processing implementation (must work to handle 200+ photos)

---

## Next Step

**BEFORE CODE GENERATION**:
Execute Phase 0 - Repository Restructuring (see `repository-restructuring-plan.md`)

**AFTER PHASE 0 COMPLETE**:
Ready to proceed with code generation

When approved, I will generate all files in the order specified above, creating:
- 48 new/updated files
- ~6,460 lines of production-ready code
- Complete documentation

This will be a **single large generation session** to ensure consistency across all components.

---

**Status**: ⬜ Awaiting Phase 0 completion + approval to generate code
**Last Updated**: 2025-10-01
