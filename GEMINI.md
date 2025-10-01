# MTÜ Kaiu Kodukant Website

## Project Overview

This project is the official website for the MTÜ Kaiu Kodukant, a community association in Kaiu, Estonia. It is a static multi-page website built with vanilla HTML, CSS (Tailwind CSS), and JavaScript.

The backend is powered by Google Apps Script, which provides a "serverless" architecture for handling:
-   **Forms:** Contact and membership forms that save data to Google Sheets.
-   **Event Calendar:** A proxy for Google Calendar events, displayed using FullCalendar.js.
-   **Photo Gallery:** A gallery of photos managed in Google Drive.

There is an ongoing project to migrate the calendar and gallery data from being served directly by Google Apps Script to an S3-compatible object storage service (Pilvio). This is intended to improve performance, caching, and reliability. The migration involves Apps Script functions that will sync data from Google services to S3, and frontend code that will fetch data from S3 instead of Apps Script.

## Building and Running

### Local Development

The project uses Docker and Caddy for local development.

1.  **Prerequisites:** Docker must be installed and running.
2.  **Start the server:** Run the following command in the project root:
    ```bash
    docker-compose up
    ```
3.  **View the site:** Open your web browser and navigate to `http://localhost`. The Caddy server will serve the static files from the `pages`, `js`, `css`, and `media` directories.

### Backend Development

The backend code is in the `apps-script/` directory. To work on the backend:

1.  Go to [Google Apps Script](https://script.google.com).
2.  Create a new project and copy the code from the `.gs` files in the `apps-script/` directory into the Apps Script editor.
3.  Configure the project as described in `SETUP.md` and `planning/s3-migration-implementation-plan.md`. This includes setting up Google Sheets, Google Drive, reCAPTCHA, and S3 credentials.
4.  Deploy the script as a web app.

## Development Conventions

-   **Frontend:** The frontend is composed of static HTML files in the `pages/` directory. Shared JavaScript is in the `js/` directory and styles are in `css/styles.css`. Tailwind CSS is used for utility classes.
-   **Backend:** The backend logic is written in Google Apps Script. The code is organized into multiple `.gs` files within the `apps-script/` directory, each with a specific responsibility (e.g., `calendar-sync.gs`, `gallery-sync-incremental.gs`, `s3-utils.gs`).
-   **Configuration:** Frontend configuration (like the Apps Script URL) is in `js/config.js`. Backend configuration is managed in `apps-script/config.gs` and uses Script Properties for sensitive data like API keys.
-   **S3 Migration:** The ongoing S3 migration is well-documented in `planning/s3-migration-implementation-plan.md`. This plan outlines the architecture and steps for moving the gallery and calendar data to S3. The new frontend logic for this is in `js/gallery-s3.js`.
