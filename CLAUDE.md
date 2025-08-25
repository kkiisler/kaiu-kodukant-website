# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static single-page application (SPA) for MTÜ Kaiu Kodukant, an Estonian non-profit organization. The project consists of a single HTML file that implements a complete website with multiple pages, an event calendar, photo gallery, and membership registration.

## Technology Stack

- **Frontend**: Pure HTML5, CSS3, and vanilla JavaScript
- **Styling**: Tailwind CSS (via CDN)
- **Calendar**: FullCalendar.js library
- **External APIs**: 
  - Google Calendar API for event data
  - AWS S3 for photo gallery storage
- **Responsive Design**: Mobile-first approach with responsive navigation

## Architecture

The application is structured as a client-side SPA with:

- **Single HTML file** (`index.html`) containing all pages and functionality
- **Page-based navigation** using JavaScript show/hide logic
- **Dynamic content loading** for calendar events and gallery photos
- **Modal dialogs** for event details and photo lightbox
- **Responsive navigation** with mobile hamburger menu

## Key Features

1. **Multi-page SPA navigation**: Home, Events, Gallery, About, Contact, Membership
2. **Event calendar**: Google Calendar integration with modal event details
3. **Photo gallery**: S3-hosted images with XML metadata and lightbox viewing
4. **Membership form**: Client-side form handling with success messages
5. **Mobile responsive**: Tailored mobile navigation and layouts

## Development

Since this is a static HTML project, there are no build commands, package managers, or test frameworks. To develop:

1. Open `index.html` directly in a web browser
2. Make changes to the HTML, CSS, or JavaScript
3. Refresh the browser to see changes
4. For production, simply upload the file to a web server

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

Key configuration values in the JavaScript:
- Google Calendar API key and calendar ID
- S3 base URL for gallery
- Color scheme defined in Tailwind config
- Responsive breakpoints and typography scales