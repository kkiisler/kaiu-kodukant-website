# MTÜ Kaiu Kodukant Website

A modern, lightweight community website for MTÜ Kaiu Kodukant (Kaiu Community Association) built with vanilla HTML, CSS, and JavaScript.

## 🌟 Features

- **📱 Responsive Design** - Optimized for all devices
- **🎨 Modern UI** - Clean, professional design with excellent typography
- **📅 Event Calendar** - Google Calendar integration via Apps Script
- **🖼️ Photo Gallery** - Google Drive-powered gallery with lightbox
- **📝 Functional Forms** - Membership registration and contact forms with Google Sheets backend
- **⚡ Fast Loading** - Single HTML file, optimized images, lazy loading
- **🔒 Secure** - reCAPTCHA protection, rate limiting, input validation
- **♿ Accessible** - Proper ARIA labels, keyboard navigation, focus states

## 🏗️ Architecture

### Frontend (Static Website)
- **Multi-page static website** with separated CSS and JavaScript
- **6 HTML pages** for different sections (Home, Events, Gallery, About, Contact, Membership)
- **Tailwind CSS** via CDN for styling
- **Custom CSS** in `css/styles.css` (348 lines)
- **JavaScript modules** for specific functionality
- **Reusable components** (footer, etc.) loaded dynamically
- **Vanilla JavaScript** for all interactions

### Backend (API Service)
- **Node.js + Express API** for form handling and admin dashboard
- **SQLite database** for storing form submissions
- **Resend** for email notifications
- **JWT authentication** for admin access
- **reCAPTCHA v3** integration for spam protection
- **Rate limiting** for security

### Content Management
- **Google Calendar** for event management (synced to S3)
- **Google Drive** for photo gallery (synced to S3)
- **S3 storage (Pilvio)** for static calendar/gallery data
- **Apps Script** for automated sync tasks

## 📁 Project Structure

```
kaiumtu/
├── pages/                  # Frontend HTML pages
│   ├── index.html          # Homepage
│   ├── events.html         # Events calendar page
│   ├── gallery.html        # Photo gallery page
│   ├── about.html          # About us page
│   ├── contact.html        # Contact form page
│   └── membership.html     # Membership registration page
├── components/             # Reusable components
│   └── footer.html         # Footer component
├── css/
│   └── styles.css          # Custom styles (348 lines)
├── js/
│   ├── config.js           # Central configuration
│   ├── common.js           # Mobile menu, navigation, component loading
│   ├── calendar.js         # Calendar integration
│   ├── gallery.js          # Gallery and lightbox
│   └── forms.js            # Form validation and handling
├── api/                    # Backend API service
│   ├── server.js           # Express server
│   ├── config/             # Configuration
│   ├── services/           # Business logic (database, email, S3)
│   ├── routes/             # API endpoints
│   ├── middleware/         # Authentication, rate limiting
│   └── views/              # Admin dashboard HTML
├── docker/                 # Docker deployment
│   ├── Dockerfile          # Web service (Caddy)
│   ├── api/Dockerfile      # API service
│   ├── docker-compose.yml  # Service orchestration
│   ├── Caddyfile.prod      # Production Caddy config
│   └── .env.example        # Environment configuration template
├── apps-script/            # Google Apps Script sync tasks
│   └── calendar-sync.js    # Calendar to S3 sync
│   └── gallery-sync.js     # Gallery to S3 sync
├── SETUP.md                # Complete setup instructions
├── DEPLOY.md               # Deployment guide
├── CLAUDE.md               # Development guidance
└── README.md               # This file
```

## 🚀 Quick Start

### For Development
```bash
# Clone the repository
git clone https://github.com/yourusername/kaiu-kodukant-website.git
cd kaiu-kodukant-website

# Serve frontend locally
python3 -m http.server 8080
# Visit http://localhost:8080/pages/

# Or run with Docker
cd docker
cp .env.example .env
# Edit .env with your configuration
docker compose up -d
```

### For Production
See detailed deployment instructions in [DEPLOY.md](DEPLOY.md):
1. **Configure environment** - Set up `.env` with all required credentials
2. **Deploy with Docker** - Two-service architecture (Web + API)
3. **Configure Resend** - Email notifications for forms
4. **Set up reCAPTCHA** - Spam protection
5. **Configure S3 sync** - Calendar and gallery data
6. **Test thoroughly** - Forms, emails, admin dashboard

## 🛠️ Development

This is a static multi-page website that can be developed with any code editor:

1. Open any HTML page in your browser to preview (or use a local server)
2. Edit HTML files, CSS in `css/styles.css`, or JavaScript modules in `js/` directory
3. Refresh browser to see changes
4. For backend changes, update the Google Apps Script

### Local Development Server (optional)
```bash
# Python 3
python3 -m http.server 8080

# Node.js
npx serve

# PHP
php -S localhost:8080
```

## 📋 Requirements

### Essential Services
- **Docker & Docker Compose** - For containerized deployment
- **Resend account** - Email notifications (100 emails/day free)
- **reCAPTCHA v3** - Form spam protection (free)
- **S3-compatible storage** - Calendar/gallery data (using Pilvio)
- **Domain name** - With SSL/TLS certificates (handled by Caddy)

### Optional Services
- **Google Calendar** - Event management (synced to S3)
- **Google Drive** - Photo gallery management (synced to S3)
- **Google Apps Script** - Automated sync tasks

See [DEPLOY.md](DEPLOY.md) for detailed setup instructions.

## 🎯 Key Features

### Community Management
- **Membership registration** with automatic email notifications
- **Contact forms** with admin notifications
- **Event calendar** with multi-editor support
- **Photo gallery** with easy drag-and-drop management

### Technical Excellence
- **Low operational costs** - Minimal resource usage with efficient caching
- **High performance** - Optimized loading, S3 CDN, separated CSS/JS
- **Easy maintenance** - Modular structure with separated concerns
- **Secure** - JWT authentication, rate limiting, HTTPS everywhere
- **Scalable** - Docker containers, horizontal scaling ready
- **Maintainable** - Clean separation of concerns, comprehensive documentation
- **Admin dashboard** - View and manage form submissions
- **Email notifications** - Instant alerts for new submissions via Resend

## 🤝 Contributing

1. Fork the repository
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📞 Support & Documentation

- **[DEPLOY.md](DEPLOY.md)** - Complete deployment guide with Docker
- **[CLAUDE.md](CLAUDE.md)** - Development guidance and project overview
- **Admin Dashboard** - Access at `https://api.kaiukodukant.ee/admin`
- **Health Check** - Monitor at `https://api.kaiukodukant.ee/health`

For technical issues:
- Check container logs: `docker compose logs -f`
- Verify environment configuration in `.env`
- Test API health endpoint
- Review form submission logs in admin dashboard

## 📄 License

This project is built for MTÜ Kaiu Kodukant. Please respect the community's work and contact them before reusing.

## 🔧 Technology Stack

### Frontend
- HTML5, CSS3, Vanilla JavaScript
- Tailwind CSS
- FullCalendar.js
- Responsive design (mobile-first)

### Backend
- Node.js 20 + Express
- SQLite database
- Resend API for emails
- JWT authentication
- bcrypt password hashing

### Infrastructure
- Docker & Docker Compose
- Caddy web server (automatic HTTPS)
- S3-compatible storage (Pilvio)
- Let's Encrypt SSL certificates

### External Services
- Google Calendar API
- Google Drive API
- reCAPTCHA v3
- Resend email service

---

**Built with ❤️ for the Kaiu community**

*Website launched 2024, API backend added 2025*