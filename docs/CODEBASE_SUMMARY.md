Codebase summary and findings

Overview

This repository contains a static website for MTÜ Kaiu Kodukant with rich client-side functionality powered by vanilla JavaScript and a Google Apps Script backend. The site is styled with Tailwind CSS (via CDN) plus a small custom CSS file. Dynamic features include:

- Events calendar powered by FullCalendar, pulling events from a Google Calendar via an Apps Script web app.
- Photo gallery backed by Google Drive folders, fetched via Apps Script and rendered with a client-side lightbox.
- Membership and contact forms protected by reCAPTCHA v3, submitted to Apps Script and stored in Google Sheets, with optional email notifications.

High-level structure

- Root HTML pages: index.html, events.html, gallery.html, about.html, contact.html, membership.html
- Static assets: css/styles.css, media/*
- Frontend scripts (js/):
  - common.js: shared navigation, mobile menu, and UX helpers
  - config.js: central configuration (window.GOOGLE_APPS_SCRIPT_URL and window.RECAPTCHA_SITE_KEY)
  - calendar.js: loads events from Apps Script (JSONP), renders FullCalendar, shows modal and “upcoming events” list
  - gallery.js: lists albums and photos via Apps Script (JSONP) with a lightbox and drive URL normalization/fallbacks
  - forms-success.js and forms-iframe.js: robust form submission via hidden iframe + postMessage (with a full success view or inline messaging)
  - forms.js and forms-jsonp.js: alternative form approaches (XHR/JSON and JSONP) that are not currently wired into the pages
  - jsonp.js: lightweight JSONP helper (duplicated inline in some feature files as well)
- Apps Script server examples: apps-script-backend.js, apps-script-complete.js, apps-script-complete-fixed.js, apps-script-cors-fix.js, apps-script-forms-handler.js
- Documentation: README.md, SETUP.md, DEPLOY.md, DEPLOY_APPS_SCRIPT.md, RECAPTCHA_CHECKLIST.md, CORS_FIX.md, FIX_CORS_NOW.md, FORM_POST_SOLUTION.md

Key frontend flows

1) Events (events.html + js/calendar.js)
- Configuration: reads window.GOOGLE_APPS_SCRIPT_URL from js/config.js
- Calls GET ?action=calendar via JSONP to avoid CORS problems
- Maps returned events into FullCalendar format, renders, and builds an “upcoming events” sidebar
- Includes an accessible event modal with date/time formatting and optional location

2) Gallery (gallery.html + js/gallery.js)
- Configuration: reads window.GOOGLE_APPS_SCRIPT_URL from js/config.js
- Calls GET ?action=gallery to list albums and GET ?action=album&id=... for photos (both via JSONP)
- Normalizes Google Drive image URLs to improve reliability and adds fallback URLs for thumbnails and full-size images
- Includes responsive grid, lazy loading, and a lightbox with keyboard navigation and preloading of adjacent images

3) Forms (membership.html, contact.html)
- Configuration: window.RECAPTCHA_SITE_KEY and window.GOOGLE_APPS_SCRIPT_URL (from js/config.js)
- reCAPTCHA v3 is loaded dynamically in-page when a site key is configured
- Submission is handled by js/forms-success.js (currently used by both membership.html and contact.html):
  - Submits to Apps Script via hidden iframe (form.target) to sidestep CORS
  - Passes formType and recaptchaToken as hidden fields
  - Waits for a postMessage from the Apps Script response; includes a 3s fallback to show success if postMessage fails
  - On success, replaces the form UI with a well-designed success view
- Alternative implementation js/forms-iframe.js shows inline success messages without replacing the entire form
- js/forms.js and js/forms-jsonp.js provide other submission strategies but are not referenced by the current HTML pages

Apps Script backend

Multiple versions are included to document different deployment and CORS strategies. apps-script-complete-fixed.js is the most comprehensive and CORS-correct example:

- doGet handles actions: calendar, gallery, album
  - Calendar: reads and caches events from a configured Google Calendar ID
  - Gallery: enumerates Google Drive folders and files to build albums and photo lists with caching
- doPost handles form submissions (membership/contact), verifies reCAPTCHA, rate-limits where applicable, appends rows to Google Sheets, and sends Gmail notifications
- Caching via CacheService for calendar and gallery data
- Critical: explicit CORS headers in responses (Access-Control-Allow-Origin set to the configured ALLOWED_DOMAIN)

Configuration

- js/config.js is the single source for frontend configuration:
  - window.GOOGLE_APPS_SCRIPT_URL = '.../exec' (deployed Apps Script web app URL)
  - window.RECAPTCHA_SITE_KEY = '...' (public v3 site key)
- .env.example documents environment values (domain, Apps Script URL, reCAPTCHA site key)
- In Apps Script, configure:
  - ALLOWED_DOMAIN to your production domain (must match the site origin when using fetch/CORS)
  - Spreadsheet IDs and sheet names for membership and contact storage
  - Calendar ID and Drive folder ID for dynamic data
  - Script property RECAPTCHA_SECRET_KEY for server-side verification

Notable findings and observations

- Multiple form implementations exist. The HTML pages currently use forms-success.js (iframe + postMessage).
  - forms.js submits JSON via fetch with { action, token, data } but the showcased Apps Script handlers expect either URL-encoded parameters or JSON containing { formType, recaptchaToken, ... }. If forms.js is ever wired up, payload shape should be aligned with the backend (or the backend extended to handle that shape).
  - forms-iframe.js provides a similar iframe approach but shows inline messages rather than replacing the form with a success view.
- JSONP is used for GET endpoints (calendar and gallery) to avoid CORS. This is fine for read-only data, but do not use JSONP for POST; the current code correctly avoids that by using an iframe or proper CORS.
- Duplicated helper code: a small JSONP helper exists as js/jsonp.js and also inline within calendar.js and gallery.js. This is harmless but could be consolidated to a single import to reduce duplication.
- Naming collisions are avoided by scoping, but constants named GOOGLE_APPS_SCRIPT_URL are re-declared in several files. They all fall back to window.GOOGLE_APPS_SCRIPT_URL, which is correct, but you may consider consistently importing from config.js only.
- Robust Drive image handling in gallery.js: the code attempts multiple URL formats for Drive images and provides inline SVG placeholders if all attempts fail. This is good for real-world reliability.
- The frontend loads Tailwind from a CDN at runtime. This is the simplest approach but means styles depend on external network availability; consider pinning versions and integrity attributes if you want tighter supply-chain control.

Potential issues and risks

- Backend/Frontend payload mismatch risk if switching form handlers:
  - If you decide to switch to fetch-based forms (forms.js), update the Apps Script doPost to accept the { action, token, data } shape and translate it to the expected fields, or update forms.js to send formType and recaptchaToken as the backend expects.
- CORS origin must match exactly:
  - In the Apps Script (e.g., apps-script-complete-fixed.js), ALLOWED_DOMAIN must be set to the exact site origin (including scheme and host). Mismatch will break fetch-based calls and some browsers’ postMessage origin checks.
- Secrets handling:
  - Do not commit the reCAPTCHA secret key; it must be stored in Apps Script Script Properties, not in this repo. The site key (public) is safe to expose in config.js.
- Mixed documentation and code variants:
  - There are several partial/alternative scripts: apps-script-backend.js, apps-script-forms-handler.js, apps-script-cors-fix.js, etc. These are useful references, but ensure the deployed backend matches what the frontend pages are using (currently iframe + postMessage flow from forms-success.js, plus JSONP for GETs).

Recommendations

- Pick and document “the” canonical form flow:
  - If you prefer the iframe + postMessage approach (no CORS headaches), keep forms-success.js and remove unused form variants from HTML to prevent confusion. Optionally move the others into an examples/ or archive/ folder.
  - If you prefer fetch + JSON, standardize the request payload and ensure the Apps Script doPost aligns with it, and verify CORS headers and ALLOWED_DOMAIN are correct in production.
- Consolidate JSONP helper usage into js/jsonp.js and import it where needed to reduce duplication.
- Consider extracting small shared utilities (e.g., date formatting, message helpers) into a single shared module if reuse grows.
- Add Subresource Integrity (SRI) and explicit version pinning for third-party CDNs (Tailwind, FullCalendar) for better supply-chain hygiene.
- Ensure config.js is environment-specific during deployment (e.g., templating or build step) so production URLs/keys are not accidentally left at placeholders.

Quick start for maintainers

- Configure js/config.js with your deployed Apps Script URL and reCAPTCHA site key.
- Deploy Apps Script using one of the provided backend files, preferably apps-script-complete-fixed.js, and set:
  - ALLOWED_DOMAIN to the site origin
  - Google Sheet IDs and sheet names
  - Google Calendar ID and Drive folder ID
  - Script property RECAPTCHA_SECRET_KEY
- Open:
  - events.html to verify calendar loads events
  - gallery.html to verify albums and photos load
  - contact.html and membership.html to test form submissions (you should see a success view and receive emails if configured)

File inventory highlights

- js/
  - calendar.js, gallery.js, common.js, config.js, forms-success.js, forms-iframe.js, forms.js, forms-jsonp.js, jsonp.js
- Backend references
  - apps-script-complete-fixed.js (recommended reference)
  - apps-script-backend.js, apps-script-forms-handler.js, apps-script-cors-fix.js (alternatives and historical notes)
- Docs
  - README.md, SETUP.md, DEPLOY.md, DEPLOY_APPS_SCRIPT.md, RECAPTCHA_CHECKLIST.md, CORS_FIX.md, FIX_CORS_NOW.md, FORM_POST_SOLUTION.md

If you want me to, I can follow up by pruning unused variants, consolidating helpers, and adding a short “Which file to deploy” matrix to the docs.
