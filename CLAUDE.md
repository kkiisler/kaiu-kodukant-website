# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static multi-page website for MTÜ Kaiu Kodukant, an Estonian non-profit organization. The project was refactored from a single 1606-line HTML file into a maintainable multi-page structure with separated CSS and JavaScript modules.

## Technology Stack

- **Frontend**: Pure HTML5, CSS3, and vanilla JavaScript
- **Styling**: Tailwind CSS (via CDN)
- **Calendar**: FullCalendar.js library
- **External APIs**: 
  - Google Calendar API for event data
  - AWS S3 for photo gallery storage
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
3. **Photo gallery**: S3-hosted images with XML metadata and lightbox viewing
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
- Google Calendar API: For fetching event data
- AWS S3: For photo gallery storage with XML metadata

## Content Management

- **Events**: Managed through Google Calendar (calendar ID: `3ab658c2becd62b9af62343da736243b73e1d56523c7c04b8ed46d944eb0e8fb@group.calendar.google.com`)
- **Gallery**: Photos stored in S3 bucket (`s3.pilw.io/kaiugalerii/`) with XML metadata files
- **Images**: Logo and hero image hosted externally

## Configuration

Key configuration values:
- Google Calendar API key and calendar ID (in `js/calendar.js`)
- S3 base URL for gallery (in `js/gallery.js`)
- Color scheme defined in Tailwind config (in each HTML file)
- Custom styles and typography (in `css/styles.css`)
- Responsive breakpoints and typography scales

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
│   ├── common.js        # Mobile menu, navigation
│   ├── calendar.js      # FullCalendar integration
│   ├── gallery.js       # Gallery and lightbox
│   └── forms.js         # Form validation and handling
└── index_original.html  # Backup of original single-page file
```