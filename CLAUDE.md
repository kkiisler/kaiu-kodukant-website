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
├── test-calendar.html   # Calendar testing page
├── test-gallery.html    # Gallery testing page
└── index_original.html  # Backup of original single-page file
```