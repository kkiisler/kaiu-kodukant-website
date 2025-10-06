# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static multi-page website for MTÜ Kaiu Kodukant, an Estonian non-profit organization. The project was refactored from a single 1606-line HTML file into a maintainable multi-page structure with separated CSS and JavaScript modules.

## Technology Stack

- **Frontend**: Pure HTML5, CSS3, and vanilla JavaScript
- **Styling**: Tailwind CSS (via CDN)
- **Calendar**: FullCalendar.js library with secure backend
- **Backend APIs**: 
  - Google Apps Script (secure proxy for calendar, forms, gallery)
  - No API keys exposed in frontend
- **Storage**:
  - Google Drive for photo gallery (via Apps Script)
  - Google Sheets for form submissions
- **Responsive Design**: Mobile-first approach with responsive navigation

## Architecture

The application is structured as a static multi-page website with:

- **6 separate HTML pages**: 
  - `index.html` - Homepage
  - `events.html` - Events calendar
  - `gallery.html` - Photo gallery
  - `about.html` - About us
  - `contact.html` - Contact form
  - `membership.html` - Membership registration
- **Extracted CSS** (`css/styles.css`) - 348 lines of custom styles
- **JavaScript modules** in `js/` directory:
  - `common.js` - Mobile menu and navigation
  - `calendar.js` - FullCalendar integration
  - `gallery.js` - Photo gallery functionality
  - `forms.js` - Form handling and validation
- **Dynamic content loading** for calendar events and gallery photos
- **Modal dialogs** for event details and photo lightbox
- **Responsive navigation** with mobile hamburger menu

## Key Features

1. **Multi-page website**: Home, Events, Gallery, About, Contact, Membership
2. **Event calendar**: Google Calendar integration with modal event details
3. **Photo gallery**: Google Drive-hosted images with automatic metadata extraction and lightbox viewing
4. **Membership form**: Client-side form handling with success messages
5. **Mobile responsive**: Tailored mobile navigation and layouts

## Development

Since this is a static HTML project, there are no build commands, package managers, or test frameworks. To develop:

1. Open any HTML page directly in a web browser or use a local server
2. Make changes to the HTML, CSS, or JavaScript files
3. Refresh the browser to see changes
4. For production, upload all files maintaining the directory structure:
   - Root: HTML files
   - `css/`: Stylesheets
   - `js/`: JavaScript modules

## External Dependencies

- Tailwind CSS: Loaded via CDN
- FullCalendar.js: Loaded via CDN for event calendar functionality
- Google Fonts (Inter): For typography
- Google Calendar API: For fetching event data (via Apps Script proxy)
- Google Drive API: For photo gallery storage (via Apps Script proxy)

## Content Management

- **Events**: Managed through Google Calendar (calendar ID: `3ab658c2becd62b9af62343da736243b73e1d56523c7c04b8ed46d944eb0e8fb@group.calendar.google.com`)
- **Gallery**: Photos stored in Google Drive folders with automatic metadata extraction
- **Images**: Logo and hero image hosted externally

## Configuration

Key configuration values:
- **Central configuration** in `js/config.js`:
  - Google Apps Script URL (backend for all API calls)
  - reCAPTCHA site key for forms
- **Backend configuration** in `apps-script-backend.js`:
  - Google Calendar ID (server-side only)
  - Gallery folder IDs
  - Cache durations
- Color scheme defined in Tailwind config (in each HTML file)
- Custom styles and typography (in `css/styles.css`)
- Responsive breakpoints and typography scales

## Security Features

- **No API keys in frontend**: All sensitive credentials stored server-side
- **CORS protection**: Apps Script restricts access to allowed domains
- **Rate limiting**: Built-in Apps Script quotas prevent abuse
- **Caching**: Reduces API calls and improves performance
- **Secure forms**: reCAPTCHA v3 protection

## Google Apps Script Development

**IMPORTANT**: All Google Apps Script code is maintained in the `apps-script/` folder for version control.

- **Location**: `/apps-script/*.gs`
- **Deployment**: Copy files to Google Apps Script editor after updating
- **Key files**:
  - `calendar-sync.gs` - Calendar synchronization to S3
  - `gallery-sync-incremental.gs` - Gallery synchronization with incremental updates
  - `drive-change-trigger.gs` - Change detection for gallery updates
  - `s3-utils.gs` - S3 upload utilities with AWS Signature v4
  - `config.gs` - Configuration and credentials
  - `triggers-setup.gs` - Automated trigger management

**When working with Apps Script**:
1. Always update the local `apps-script/*.gs` files in the repository
2. Test changes thoroughly before deployment
3. Provide the complete updated file content for copying to Google Apps Script editor
4. Remember these scripts run on Google's infrastructure with scheduled triggers

## Deployment and Testing

**Production Environment**:
- The production website runs on a VM, not locally
- SSH access: `ssh kkiisler@kaiukodukant.ee`
- Deployment location: `/home/kkiisler/kaiu-kodukant-website`
- Services run in Docker containers (web and api)

**Development Workflow**:
1. Make changes locally in this repository
2. Test functionality thoroughly
3. Verify the implementation meets requirements
4. Write comprehensive commit messages describing all changes
5. Push to GitHub: `git push origin main`
6. Deploy to production via SSH when ready

**Testing Protocol**:
- After implementing planned features, always test the results
- Verify both functionality and visual appearance
- Check monitoring dashboards for sync status
- Ensure no regressions in existing features
- Only commit and push after confirming everything works as expected

## File Structure

```
├── index.html           # Homepage
├── events.html          # Events calendar page
├── gallery.html         # Photo gallery page
├── about.html           # About us page
├── contact.html         # Contact form page
├── membership.html      # Membership registration page
├── css/
│   └── styles.css       # Custom styles (348 lines)
├── js/
│   ├── config.js        # Central configuration
│   ├── common.js        # Mobile menu, navigation
│   ├── calendar.js      # FullCalendar integration
│   ├── gallery.js       # Gallery and lightbox
│   └── forms.js         # Form validation and handling
├── apps-script/         # Google Apps Script source files
│   ├── calendar-sync.gs
│   ├── gallery-sync-incremental.gs
│   ├── drive-change-trigger.gs
│   └── ...
├── api/                 # Backend API (Node.js)
│   ├── routes/
│   ├── services/
│   └── server.js
├── docker/              # Docker configuration
│   ├── docker-compose.yml
│   └── deploy.sh
├── test-calendar.html   # Calendar testing page
├── test-gallery.html    # Gallery testing page
└── index_original.html  # Backup of original single-page file
```