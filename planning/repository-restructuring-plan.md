# Repository Restructuring Plan

**Date**: 2025-10-01
**Purpose**: Organize HTML files into `pages/` folder for cleaner repository structure
**Approved**: Option A - `pages/` folder with clean URLs

---

## Current Structure (Before)

```
kaiumtu/
├── index.html
├── about.html
├── events.html
├── gallery.html
├── membership.html
├── contact.html
├── index_original.html          # Backup
├── test-calendar.html           # Obsolete
├── test-gallery.html            # Obsolete
├── test-lightbox.html           # Obsolete
├── test-recaptcha.html          # Obsolete
├── css/
├── js/
├── media/
├── docker/
├── planning/
└── [other files...]
```

**Issues**:
- ❌ 11 HTML files cluttering root directory
- ❌ Mix of production and test files
- ❌ Difficult to distinguish active vs backup files

---

## New Structure (After)

```
kaiumtu/
├── pages/                       # NEW: All production HTML pages
│   ├── index.html              # Homepage
│   ├── about.html              # About us
│   ├── events.html             # Events calendar
│   ├── gallery.html            # Photo gallery
│   ├── membership.html         # Membership registration
│   └── contact.html            # Contact form
├── css/                         # Existing
├── js/                          # Existing
├── media/                       # Existing
├── api/                         # NEW: Node.js API backend
├── apps-script/                 # NEW: Google Apps Script files
├── docker/                      # Existing (will be updated)
├── planning/                    # Existing
├── archive/                     # Existing
│   ├── index_original.html     # MOVED: Original backup
│   ├── tests/                  # NEW: Obsolete test files
│   │   ├── test-calendar.html
│   │   ├── test-gallery.html
│   │   ├── test-lightbox.html
│   │   └── test-recaptcha.html
│   ├── gallery-cloudflare/     # Existing
│   ├── gallery-migration/      # Existing
│   └── calendar-old/           # Existing
└── [other files...]
```

**Benefits**:
- ✅ Clean root directory (only folders)
- ✅ All pages organized in one place
- ✅ Test files archived separately
- ✅ Clear separation of concerns
- ✅ Professional structure

---

## File Moves Required

### Move to `pages/`
```bash
mv index.html pages/
mv about.html pages/
mv events.html pages/
mv gallery.html pages/
mv membership.html pages/
mv contact.html pages/
```

### Move to `archive/`
```bash
mv index_original.html archive/
```

### Move to `archive/tests/`
```bash
mkdir -p archive/tests
mv test-calendar.html archive/tests/
mv test-gallery.html archive/tests/
mv test-lightbox.html archive/tests/
mv test-recaptcha.html archive/tests/
```

---

## Docker Configuration Updates

### 1. Dockerfile Changes

**File**: `docker/Dockerfile`

**Before** (Line 42):
```dockerfile
COPY --from=builder /app/*.html /usr/share/caddy/
```

**After**:
```dockerfile
COPY --from=builder /app/pages /usr/share/caddy/pages
```

**Full updated section**:
```dockerfile
# Production stage with Caddy
FROM caddy:2.7-alpine

# Copy processed static files from builder
COPY --from=builder /app/pages /usr/share/caddy/pages
COPY --from=builder /app/css /usr/share/caddy/css
COPY --from=builder /app/js /usr/share/caddy/js
COPY --from=builder /app/media /usr/share/caddy/media

# Set working directory
WORKDIR /usr/share/caddy

# Expose ports
EXPOSE 80 443

# Default command
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
```

---

### 2. Caddyfile.prod Updates

**File**: `docker/Caddyfile.prod`

**Add URL rewrite rules** (after line 5, before `file_server`):

```caddyfile
{$DOMAIN_NAME} {
	# Enable file server
	root * /usr/share/caddy

	# URL rewriting for clean URLs
	# Maps root URLs to pages/ directory
	@html {
		path /
		path /about
		path /events
		path /gallery
		path /membership
		path /contact
	}

	rewrite @html /pages{path}.html

	# Special case for root
	rewrite / /pages/index.html

	file_server

	# ... rest of existing config ...
}
```

**Complete updated section**:
```caddyfile
{$DOMAIN_NAME} {
	# Enable file server
	root * /usr/share/caddy

	# URL rewriting for clean URLs
	@html {
		path /
		path /about
		path /events
		path /gallery
		path /membership
		path /contact
	}

	rewrite @html /pages{path}.html
	rewrite / /pages/index.html

	file_server

	# Enable compression
	encode gzip zstd

	# Security headers (stricter for production)
	header {
		# ... existing headers ...
	}

	# Cache static assets aggressively
	@static {
		path *.css *.js *.jpg *.jpeg *.png *.gif *.svg *.ico *.woff *.woff2 *.ttf *.eot
	}
	header @static {
		Cache-Control "public, max-age=31536000, immutable"
	}

	# Cache HTML files for shorter period
	@html_cache {
		path *.html
	}
	header @html_cache {
		Cache-Control "public, max-age=3600, must-revalidate"
	}

	# ... rest of existing config ...
}
```

---

### 3. Caddyfile (Development) Updates

**File**: `docker/Caddyfile`

**If exists**, apply same rewrite rules as `Caddyfile.prod`:

```caddyfile
:80 {
	root * /usr/share/caddy

	# URL rewriting
	@html {
		path /
		path /about
		path /events
		path /gallery
		path /membership
		path /contact
	}

	rewrite @html /pages{path}.html
	rewrite / /pages/index.html

	file_server
	encode gzip

	# ... rest of config ...
}
```

---

## URL Mapping (Before → After)

| Old URL | New URL | Served File |
|---------|---------|-------------|
| `kaiukodukant.ee/index.html` | `kaiukodukant.ee/` | `pages/index.html` |
| `kaiukodukant.ee/about.html` | `kaiukodukant.ee/about` | `pages/about.html` |
| `kaiukodukant.ee/events.html` | `kaiukodukant.ee/events` | `pages/events.html` |
| `kaiukodukant.ee/gallery.html` | `kaiukodukant.ee/gallery` | `pages/gallery.html` |
| `kaiukodukant.ee/membership.html` | `kaiukodukant.ee/membership` | `pages/membership.html` |
| `kaiukodukant.ee/contact.html` | `kaiukodukant.ee/contact` | `pages/contact.html` |

**Benefits**:
- ✅ Clean URLs (no `.html` extension)
- ✅ Both `/about` and `/about.html` work
- ✅ Root `/` serves homepage
- ✅ SEO-friendly URLs

---

## Internal Link Updates

Since pages move to `pages/` folder, we need to update internal navigation links in HTML files.

### Navigation Links (All Pages)

**Before**:
```html
<nav>
    <a href="index.html">Avaleht</a>
    <a href="events.html">Üritused</a>
    <a href="gallery.html">Galerii</a>
    <a href="about.html">Meist</a>
    <a href="contact.html">Kontakt</a>
    <a href="membership.html">Liitu</a>
</nav>
```

**After** (two options):

**Option 1: Absolute paths (RECOMMENDED)**:
```html
<nav>
    <a href="/">Avaleht</a>
    <a href="/events">Üritused</a>
    <a href="/gallery">Galerii</a>
    <a href="/about">Meist</a>
    <a href="/contact">Kontakt</a>
    <a href="/membership">Liitu</a>
</nav>
```

**Option 2: Relative with .html**:
```html
<nav>
    <a href="index.html">Avaleht</a>
    <a href="events.html">Üritused</a>
    <a href="gallery.html">Galerii</a>
    <a href="about.html">Meist</a>
    <a href="contact.html">Kontakt</a>
    <a href="membership.html">Liitu</a>
</nav>
```

**Recommendation**: Use **Option 1 (absolute paths)** for:
- Cleaner URLs
- Works regardless of current page
- SEO benefits
- Consistent with modern web standards

---

## CSS/JS Path Updates

Since pages are now in `pages/` subfolder, need to update relative paths.

### CSS Links

**Before** (in HTML files):
```html
<link href="css/styles.css" rel="stylesheet">
```

**After**:
```html
<link href="/css/styles.css" rel="stylesheet">
```

### JavaScript Links

**Before**:
```html
<script src="js/common.js"></script>
<script src="js/calendar.js"></script>
<script src="js/gallery.js"></script>
```

**After**:
```html
<script src="/js/common.js"></script>
<script src="/js/calendar.js"></script>
<script src="/js/gallery.js"></script>
```

### Media/Images

**Before**:
```html
<img src="media/logo.png" alt="Logo">
```

**After**:
```html
<img src="/media/logo.png" alt="Logo">
```

**Note**: All paths should start with `/` to be absolute from root.

---

## Testing Checklist

After restructuring, verify:

### Local Testing (Before Deployment)
- [ ] Create `pages/` folder
- [ ] Move all HTML files
- [ ] Update Dockerfile
- [ ] Update Caddyfile
- [ ] Build Docker image locally
- [ ] Test all URLs:
  - [ ] `/` → homepage loads
  - [ ] `/about` → about page loads
  - [ ] `/events` → events page loads
  - [ ] `/gallery` → gallery page loads
  - [ ] `/membership` → membership page loads
  - [ ] `/contact` → contact page loads
- [ ] Verify CSS/JS loads correctly
- [ ] Verify images load correctly
- [ ] Test navigation links

### After Deployment
- [ ] All pages accessible
- [ ] Navigation works
- [ ] Static assets load (CSS/JS/images)
- [ ] Forms still submit correctly
- [ ] Calendar displays
- [ ] Gallery displays
- [ ] No 404 errors in browser console

---

## Rollback Plan

If issues occur after restructuring:

### Quick Rollback (Revert Files)
```bash
# Move HTML files back to root
mv pages/*.html .
rmdir pages

# Restore old Dockerfile
git checkout docker/Dockerfile

# Restore old Caddyfile
git checkout docker/Caddyfile.prod

# Rebuild and deploy
cd docker && ./deploy.sh
```

### Git Rollback
```bash
# If committed, revert the commit
git revert <commit-hash>

# Or reset to previous state
git reset --hard HEAD~1

# Redeploy
cd docker && ./deploy.sh
```

---

## Implementation Steps

### Step 1: Create Folder Structure
```bash
cd /Users/kkiisler/Documents/Dev/kaiumtu
mkdir -p pages
mkdir -p archive/tests
```

### Step 2: Move Files
```bash
# Move production HTML to pages/
mv index.html pages/
mv about.html pages/
mv events.html pages/
mv gallery.html pages/
mv membership.html pages/
mv contact.html pages/

# Move backup to archive/
mv index_original.html archive/

# Move test files to archive/tests/
mv test-*.html archive/tests/
```

### Step 3: Update HTML Files
- Update all navigation links to absolute paths (`/about` instead of `about.html`)
- Update all CSS links to `/css/...`
- Update all JS links to `/js/...`
- Update all image links to `/media/...`

### Step 4: Update Docker Configuration
- Update `docker/Dockerfile` (copy pages/)
- Update `docker/Caddyfile.prod` (add rewrite rules)
- Update `docker/Caddyfile` if exists

### Step 5: Test Locally (Optional)
```bash
cd docker
docker compose build
docker compose up -d
# Test at http://localhost
```

### Step 6: Commit Changes
```bash
git add pages/
git add archive/tests/
git add docker/
git commit -m "Restructure: Move HTML files to pages/ folder

- Move all production HTML to pages/
- Archive test files in archive/tests/
- Update Docker configuration for new structure
- Update Caddy to serve pages/ with clean URLs
- Update internal links to use absolute paths
"
```

### Step 7: Deploy
```bash
cd docker
./deploy.sh
```

### Step 8: Verify Deployment
- Visit all pages and verify they load
- Check browser console for errors
- Test navigation
- Test forms

---

## Updated Code Generation Plan Impact

This restructuring affects the **Code Generation Plan** as follows:

### Frontend Updates Section

**Before**:
```
membership.html                    # UPDATED: Use new form handler
contact.html                       # UPDATED: Use new form handler
```

**After**:
```
pages/membership.html              # UPDATED: Use new form handler
pages/contact.html                 # UPDATED: Use new form handler
pages/gallery.html                 # UPDATED: Fetch from S3
pages/events.html                  # UPDATED: Fetch from S3 (calendar)
pages/index.html                   # UPDATED: Links to absolute paths
pages/about.html                   # UPDATED: Links to absolute paths
```

### Docker Configuration Section

**Additional changes**:
- Dockerfile: Update COPY command for pages/
- Caddyfile.prod: Add URL rewrite rules
- Caddyfile: Add URL rewrite rules (if exists)

**Impact**: Minimal - these are straightforward updates that fit naturally into the code generation workflow.

---

## Timeline

| Task | Duration | When |
|------|----------|------|
| Create folders | 1 min | Before code generation |
| Move files | 2 min | Before code generation |
| Update Docker config | 5 min | During code generation |
| Update HTML files | 10 min | During code generation |
| Test locally | 10 min | Optional |
| Deploy | 5 min | During migration |
| **Total** | **~30 min** | **Part of migration** |

---

## Benefits Summary

### Developer Experience
- ✅ Clean project root
- ✅ Easy to find all pages
- ✅ Professional structure
- ✅ Easier to maintain

### User Experience
- ✅ Clean URLs (no .html)
- ✅ SEO-friendly
- ✅ Consistent navigation
- ✅ Modern web standards

### Deployment
- ✅ Clear separation of assets
- ✅ Easy to configure caching
- ✅ Simpler Docker config
- ✅ Better organization

---

## Integration with Migration Plan

This restructuring will be **Phase 0** of the migration:

```
Phase 0: Repository Restructuring (30 min)
  └─ Move HTML files to pages/
  └─ Archive test files
  └─ Update Docker configuration

Phase 1: Apps Script Setup
  └─ [existing plan...]

Phase 2: API Backend Setup
  └─ [existing plan...]

[... rest of migration phases ...]
```

---

## Status

- [x] Plan created
- [ ] Folders created
- [ ] Files moved
- [ ] Docker config updated
- [ ] HTML files updated
- [ ] Tested locally
- [ ] Deployed
- [ ] Verified

---

**Approved**: 2025-10-01
**Next Step**: Execute restructuring before code generation
