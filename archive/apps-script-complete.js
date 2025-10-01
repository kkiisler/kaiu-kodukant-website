// Google Apps Script - Complete backend with postMessage responses
// Deploy as Web App with "Execute as: Me" and "Who has access: Anyone"

// ========== CONFIGURATION ==========
// Replace these with your actual IDs
const CALENDAR_ID = '3ab658c2becd62b9af62343da736243b73e1d56523c7c04b8ed46d944eb0e8fb@group.calendar.google.com';

// Spreadsheet IDs for forms (create these sheets first)
const MEMBERSHIP_SPREADSHEET_ID = 'YOUR_MEMBERSHIP_SPREADSHEET_ID'; // Replace with your sheet ID
const CONTACT_SPREADSHEET_ID = 'YOUR_CONTACT_SPREADSHEET_ID'; // Replace with your sheet ID
const MEMBERSHIP_SHEET_NAME = 'Liikmed';
const CONTACT_SHEET_NAME = 'Kontaktid';

// Gallery configuration
const GALLERY_FOLDERS = {
    'uritused': '1YB-7M0gGuxgQQHqoitT_5R00L-bP_JZc',
    'kogukond': '1F7B0DAAWkmNnMp9xaBB53g3W5UM5zBx0',
    'ajalugu': '1AyLOKKQJRQYRjRHGzJn0HH91Hg8J2Xqe'
};

// Email notification (optional)
const ADMIN_EMAIL = 'info@kaiukodukant.ee'; // Replace with your email

// Security
const RECAPTCHA_THRESHOLD = 0.5; // Lower to 0.3 for testing
const RATE_LIMIT_HOURS = 1; // Hours between submissions
const CACHE_DURATION = 300; // 5 minutes in seconds

// ========== HELPER FUNCTION FOR IFRAME RESPONSES ==========
function respondToIframe(ok, formType, message, details) {
    const payload = {
        ok: !!ok,
        formType: formType || '',
        message: message || '',
        details: details || ''
    };
    
    // Return HTML that posts message to parent
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Form Response</title>
</head>
<body>
    <script>
        try {
            if (parent && parent !== window) {
                parent.postMessage(${JSON.stringify(payload)}, "*");
                console.log('Message sent to parent:', ${JSON.stringify(payload)});
            }
        } catch (e) {
            console.error('Error sending message to parent:', e);
        }
    </script>
    <p>${ok ? 'Success' : 'Error'}: ${message}</p>
</body>
</html>`;
    
    return HtmlService.createHtmlOutput(html)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ========== MAIN REQUEST HANDLERS ==========
function doGet(e) {
    const action = e.parameter.action;
    const callback = e.parameter.callback;
    
    if (!callback) {
        return ContentService.createTextOutput('Callback parameter required')
            .setMimeType(ContentService.MimeType.TEXT);
    }
    
    let result;
    
    switch(action) {
        case 'calendar':
            result = getCalendarEvents();
            break;
        case 'gallery':
            result = getGalleryAlbums();
            break;
        case 'album':
            const folderId = e.parameter.folderId;
            result = getAlbumPhotos(folderId);
            break;
        default:
            result = { error: 'Invalid action' };
    }
    
    const jsonpResponse = `${callback}(${JSON.stringify(result)})`;
    return ContentService.createTextOutput(jsonpResponse)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(e) {
    try {
        // Parse form data
        let data;
        if (e.postData && e.postData.type === 'application/json') {
            data = JSON.parse(e.postData.contents);
        } else if (e.parameter) {
            data = e.parameter;
        } else {
            return respondToIframe(false, '', 'Server ei saanud andmeid.');
        }
        
        console.log('Received POST data:', JSON.stringify(data));
        
        // Route to appropriate handler
        if (data.formType === 'membership') {
            return handleMembershipForm(data);
        } else if (data.formType === 'contact') {
            return handleContactForm(data);
        }
        
        return respondToIframe(false, '', 'Vigane vormitüüp.');
        
    } catch (err) {
        console.error('doPost error:', err);
        return respondToIframe(false, '', 'Serveri viga.', err.toString());
    }
}

// ========== FORM HANDLERS ==========
function handleMembershipForm(data) {
    try {
        // Validate required fields
        if (!data.name || !data.email) {
            return respondToIframe(false, 'membership', 'Nimi ja e-post on kohustuslikud.');
        }
        
        // Get reCAPTCHA configuration
        const scriptProperties = PropertiesService.getScriptProperties();
        const recaptchaSecretKey = scriptProperties.getProperty('RECAPTCHA_SECRET_KEY');
        
        // Verify reCAPTCHA if configured
        if (recaptchaSecretKey && data.recaptchaToken && data.recaptchaToken !== 'DEV_BYPASS') {
            const verificationResult = verifyRecaptcha(recaptchaSecretKey, data.recaptchaToken);
            if (!verificationResult.success) {
                console.log('reCAPTCHA verification failed:', verificationResult);
                return respondToIframe(false, 'membership', 'Turvakontroll ebaõnnestus. Palun proovi uuesti.');
            }
            console.log('reCAPTCHA score:', verificationResult.score);
        } else if (data.recaptchaToken === 'DEV_BYPASS') {
            console.log('DEV_BYPASS token accepted for testing');
        } else if (!recaptchaSecretKey) {
            console.warn('RECAPTCHA_SECRET_KEY not configured in Script Properties');
        }
        
        // Open or create spreadsheet
        let sheet;
        try {
            sheet = SpreadsheetApp.openById(MEMBERSHIP_SPREADSHEET_ID).getSheetByName(MEMBERSHIP_SHEET_NAME);
        } catch (err) {
            console.error('Could not open membership spreadsheet:', err);
            return respondToIframe(false, 'membership', 'Serveri seadistuse viga. Kontrolli MEMBERSHIP_SPREADSHEET_ID.');
        }
        
        if (!sheet) {
            // Create sheet if it doesn't exist
            const spreadsheet = SpreadsheetApp.openById(MEMBERSHIP_SPREADSHEET_ID);
            sheet = spreadsheet.insertSheet(MEMBERSHIP_SHEET_NAME);
            sheet.appendRow(['Kuupäev', 'Nimi', 'E-post', 'Telefon', 'Aadress', 'Sünnikuupäev', 'Lisainfo']);
        }
        
        // Check for duplicate
        const emailColumn = sheet.getRange('C:C').getValues();
        for (let i = 0; i < emailColumn.length; i++) {
            if (emailColumn[i][0] === data.email) {
                return respondToIframe(false, 'membership', 'See e-posti aadress on juba registreeritud!');
            }
        }
        
        // Add to spreadsheet
        sheet.appendRow([
            new Date(),
            data.name || '',
            data.email || '',
            data.phone || '',
            data.address || '',
            data.birthdate || '',
            data.additional || ''
        ]);
        
        // Send email notification if configured
        if (ADMIN_EMAIL !== 'info@kaiukodukant.ee') {
            try {
                MailApp.sendEmail({
                    to: ADMIN_EMAIL,
                    subject: 'Uus liikmeavaldus - ' + data.name,
                    body: `Uus liikmeavaldus:
                    
Nimi: ${data.name}
E-post: ${data.email}
Telefon: ${data.phone || 'Puudub'}
Aadress: ${data.address || 'Puudub'}
Sünnikuupäev: ${data.birthdate || 'Puudub'}
Lisainfo: ${data.additional || 'Puudub'}

Esitatud: ${new Date().toLocaleString('et-EE')}`
                });
            } catch (err) {
                console.error('Email notification failed:', err);
            }
        }
        
        return respondToIframe(true, 'membership', 'Täname liitumise eest! Saadame teile peagi kinnituse e-posti.');
        
    } catch (err) {
        console.error('Membership form error:', err);
        return respondToIframe(false, 'membership', 'Vabandust, tekkis tehniline viga.', err.toString());
    }
}

function handleContactForm(data) {
    try {
        // Validate required fields
        if (!data.name || !data.email || !data.message) {
            return respondToIframe(false, 'contact', 'Nimi, e-post ja sõnum on kohustuslikud.');
        }
        
        // Get reCAPTCHA configuration
        const scriptProperties = PropertiesService.getScriptProperties();
        const recaptchaSecretKey = scriptProperties.getProperty('RECAPTCHA_SECRET_KEY');
        
        // Verify reCAPTCHA if configured
        if (recaptchaSecretKey && data.recaptchaToken && data.recaptchaToken !== 'DEV_BYPASS') {
            const verificationResult = verifyRecaptcha(recaptchaSecretKey, data.recaptchaToken);
            if (!verificationResult.success) {
                console.log('reCAPTCHA verification failed:', verificationResult);
                return respondToIframe(false, 'contact', 'Turvakontroll ebaõnnestus. Palun proovi uuesti.');
            }
            console.log('reCAPTCHA score:', verificationResult.score);
        } else if (data.recaptchaToken === 'DEV_BYPASS') {
            console.log('DEV_BYPASS token accepted for testing');
        } else if (!recaptchaSecretKey) {
            console.warn('RECAPTCHA_SECRET_KEY not configured in Script Properties');
        }
        
        // Open or create spreadsheet
        let sheet;
        try {
            sheet = SpreadsheetApp.openById(CONTACT_SPREADSHEET_ID).getSheetByName(CONTACT_SHEET_NAME);
        } catch (err) {
            console.error('Could not open contact spreadsheet:', err);
            return respondToIframe(false, 'contact', 'Serveri seadistuse viga. Kontrolli CONTACT_SPREADSHEET_ID.');
        }
        
        if (!sheet) {
            // Create sheet if it doesn't exist
            const spreadsheet = SpreadsheetApp.openById(CONTACT_SPREADSHEET_ID);
            sheet = spreadsheet.insertSheet(CONTACT_SHEET_NAME);
            sheet.appendRow(['Kuupäev', 'Nimi', 'E-post', 'Telefon', 'Teema', 'Sõnum']);
        }
        
        // Add to spreadsheet
        sheet.appendRow([
            new Date(),
            data.name || '',
            data.email || '',
            data.phone || '',
            data.subject || 'Teema puudub',
            data.message || ''
        ]);
        
        // Send email notification if configured
        if (ADMIN_EMAIL !== 'info@kaiukodukant.ee') {
            try {
                MailApp.sendEmail({
                    to: ADMIN_EMAIL,
                    subject: 'Uus kontaktivorm - ' + (data.subject || 'Teema puudub'),
                    body: `Uus kontaktivorm:
                    
Nimi: ${data.name}
E-post: ${data.email}
Telefon: ${data.phone || 'Puudub'}
Teema: ${data.subject || 'Teema puudub'}
Sõnum: ${data.message}

Esitatud: ${new Date().toLocaleString('et-EE')}`
                });
            } catch (err) {
                console.error('Email notification failed:', err);
            }
        }
        
        return respondToIframe(true, 'contact', 'Täname! Teie sõnum on saadetud ja vastame esimesel võimalusel.');
        
    } catch (err) {
        console.error('Contact form error:', err);
        return respondToIframe(false, 'contact', 'Vabandust, tekkis tehniline viga.', err.toString());
    }
}

// ========== RECAPTCHA VERIFICATION ==========
function verifyRecaptcha(secretKey, token) {
    try {
        const response = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            payload: {
                secret: secretKey,
                response: token
            }
        });
        
        const result = JSON.parse(response.getContentText());
        console.log('reCAPTCHA verification result:', result);
        
        // Check if successful and score is above threshold
        if (result.success && result.score >= RECAPTCHA_THRESHOLD) {
            return { success: true, score: result.score };
        } else {
            return { 
                success: false, 
                score: result.score || 0,
                message: result['error-codes'] ? result['error-codes'].join(', ') : 'Score too low'
            };
        }
        
    } catch (err) {
        console.error('reCAPTCHA verification error:', err);
        return { success: false, message: err.toString() };
    }
}

// ========== CALENDAR FUNCTIONS ==========
function getCalendarEvents() {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'calendar_events';
    const cached = cache.get(cacheKey);
    
    if (cached) {
        return JSON.parse(cached);
    }
    
    try {
        const now = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 3);
        
        const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
        const events = calendar.getEvents(now, endDate);
        
        const formattedEvents = events.map(event => ({
            title: event.getTitle(),
            start: event.getStartTime().toISOString(),
            end: event.getEndTime().toISOString(),
            description: event.getDescription() || '',
            location: event.getLocation() || '',
            allDay: event.isAllDayEvent()
        }));
        
        const result = { events: formattedEvents };
        cache.put(cacheKey, JSON.stringify(result), CACHE_DURATION);
        
        return result;
    } catch (error) {
        console.error('Calendar error:', error);
        return { error: 'Failed to fetch events', events: [] };
    }
}

// ========== GALLERY FUNCTIONS ==========
function getGalleryAlbums() {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'gallery_albums';
    const cached = cache.get(cacheKey);
    
    if (cached) {
        return JSON.parse(cached);
    }
    
    try {
        const albums = [];
        
        for (const [albumId, folderId] of Object.entries(GALLERY_FOLDERS)) {
            const folder = DriveApp.getFolderById(folderId);
            const photos = folder.getFilesByType('image/jpeg');
            
            let coverImage = null;
            let photoCount = 0;
            
            while (photos.hasNext()) {
                const file = photos.next();
                photoCount++;
                if (photoCount === 1) {
                    coverImage = {
                        id: file.getId(),
                        name: file.getName(),
                        thumbnailUrl: `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w400`
                    };
                }
            }
            
            const albumName = albumId === 'uritused' ? 'Üritused' :
                            albumId === 'kogukond' ? 'Kogukond' :
                            albumId === 'ajalugu' ? 'Ajalugu' : albumId;
            
            albums.push({
                id: albumId,
                name: albumName,
                folderId: folderId,
                coverImage: coverImage,
                photoCount: photoCount,
                lastModified: folder.getLastUpdated()
            });
        }
        
        const result = { albums: albums };
        cache.put(cacheKey, JSON.stringify(result), CACHE_DURATION);
        
        return result;
    } catch (error) {
        console.error('Gallery error:', error);
        return { error: 'Failed to fetch albums', albums: [] };
    }
}

function getAlbumPhotos(folderId) {
    if (!folderId) {
        return { error: 'Folder ID required', photos: [] };
    }
    
    const cache = CacheService.getScriptCache();
    const cacheKey = `album_${folderId}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
        return JSON.parse(cached);
    }
    
    try {
        const folder = DriveApp.getFolderById(folderId);
        const files = folder.getFilesByType('image/jpeg');
        const photos = [];
        
        while (files.hasNext()) {
            const file = files.next();
            photos.push({
                id: file.getId(),
                name: file.getName(),
                description: file.getDescription() || '',
                thumbnailUrl: `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w400`,
                fullUrl: `https://drive.google.com/uc?id=${file.getId()}`,
                size: file.getSize(),
                created: file.getDateCreated().toISOString()
            });
        }
        
        const result = { 
            albumName: folder.getName(),
            photos: photos 
        };
        cache.put(cacheKey, JSON.stringify(result), CACHE_DURATION);
        
        return result;
    } catch (error) {
        console.error('Album photos error:', error);
        return { error: 'Failed to fetch photos', photos: [] };
    }
}

// ========== TEST FUNCTIONS ==========
function testMembershipForm() {
    const testData = {
        formType: 'membership',
        name: 'Test User',
        email: 'test@example.com',
        phone: '12345678',
        recaptchaToken: 'DEV_BYPASS'
    };
    
    const result = handleMembershipForm(testData);
    console.log('Test result:', result.getContent());
}

function testContactForm() {
    const testData = {
        formType: 'contact',
        name: 'Test User',
        email: 'test@example.com',
        message: 'Test message',
        recaptchaToken: 'DEV_BYPASS'
    };
    
    const result = handleContactForm(testData);
    console.log('Test result:', result.getContent());
}