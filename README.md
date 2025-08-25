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

### Frontend
- **Single HTML file** with embedded CSS and JavaScript
- **Tailwind CSS** via CDN for styling
- **FullCalendar.js** for event calendar
- **Vanilla JavaScript** for all interactions

### Backend
- **Google Apps Script** handles all server-side functionality
- **Google Sheets** for data storage (forms, member data)
- **Google Drive** for photo gallery management
- **Google Calendar** for event management

## 📁 Project Structure

```
kaiumtu/
├── index.html              # Main website file
├── apps-script-backend.js   # Google Apps Script backend code
├── SETUP.md                # Complete setup instructions
├── CLAUDE.md               # Development guidance
├── examples/               # Reference implementations
│   ├── code.js            # Example Apps Script code
│   └── index (2).html     # Example form implementation
└── README.md              # This file
```

## 🚀 Quick Start

1. **Deploy the website**: Upload `index.html` to any web server
2. **Set up backend**: Follow instructions in `SETUP.md` to configure:
   - Google Apps Script for forms and calendar
   - Google Sheets for data storage
   - Google Drive for photo gallery
   - reCAPTCHA for form protection

## 🛠️ Development

This is a static website that can be developed with any code editor:

1. Open `index.html` in your browser to preview
2. Edit HTML, CSS, or JavaScript directly in the file
3. Refresh browser to see changes
4. For backend changes, update the Google Apps Script

## 📋 Setup Requirements

- Google Account (for Apps Script, Sheets, Drive, Calendar)
- reCAPTCHA account (free)
- Web hosting (any static host works)

See `SETUP.md` for detailed setup instructions.

## 🎯 Key Features

### Community Management
- **Membership registration** with automatic email notifications
- **Contact forms** with admin notifications
- **Event calendar** with multi-editor support
- **Photo gallery** with easy drag-and-drop management

### Technical Excellence
- **Zero server costs** - uses Google's free tier
- **High performance** - optimized loading and caching
- **Easy maintenance** - non-technical users can manage content
- **Secure** - enterprise-grade Google infrastructure

## 🤝 Contributing

1. Fork the repository
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📞 Support

For technical issues or questions:
- Check `SETUP.md` for configuration help
- Review `CLAUDE.md` for development guidance
- Contact the development team

## 📄 License

This project is built for MTÜ Kaiu Kodukant. Please respect the community's work and contact them before reusing.

---

**Built with ❤️ for the Kaiu community**

*Website design and development completed in 2024*