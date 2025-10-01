// MTÜ Kaiu Kodukant Complete Backend - Google Apps Script
// Fixed version with proper CORS headers

// Configuration
const MEMBERSHIP_SPREADSHEET_ID = '1scwMSkGu0wz0pZYSGX1lQvo2xJnR_UdFhGT_wEa-Upw';
const CONTACT_SPREADSHEET_ID = '1U0gW3V6DLbuVSDfryuIVzfaoOe1JqG-DXo9NXIm3AF0';
const MEMBERSHIP_SHEET_NAME = 'Liikmed';
const CONTACT_SHEET_NAME = 'Sõnumid';
const RECAPTCHA_THRESHOLD = 0.5;
const RATE_LIMIT_HOURS = 1;
const ALLOWED_DOMAIN = 'https://tore.kaiukodukant.ee';

// Google Calendar Configuration
const GOOGLE_CALENDAR_ID = 'a0b18dc4b7e4b9b40858746a7edddaa51b41014085ba2f4b2f89bf038ac13f12@group.calendar.google.com';
const CALENDAR_CACHE_MINUTES = 15;

// Google Drive Gallery Configuration
const GALLERY_DRIVE_FOLDER_ID = '1t2olfDcjsRHFWovLbiOTRBFMYbZQdNdg';
const GALLERY_CACHE_MINUTES = 30;
const ALBUM_CACHE_MINUTES = 60;

/**
 * MAIN GET HANDLER - FIXED WITH PROPER CORS
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    let responseData;
    
    // Route to appropriate handler
    if (action === 'calendar') {
      responseData = handleCalendarRequest();
    } else if (action === 'gallery') {
      responseData = handleGalleryRequest();
    } else if (action === 'album') {
      const albumId = e.parameter.id;
      responseData = handleAlbumRequest(albumId);
    } else {
      responseData = {
        status: 'error',
        message: 'Invalid action. Use ?action=calendar, ?action=gallery, or ?action=album&id=ALBUM_ID'
      };
    }
    
    // CREATE RESPONSE WITH EXPLICIT CORS HEADERS
    return createCORSResponse(responseData);
    
  } catch (error) {
    console.error('Error in doGet:', error.toString());
    return createCORSResponse({
      status: 'error',
      message: 'Server error occurred',
      details: error.toString()
    });
  }
}

/**
 * MAIN POST HANDLER - FIXED WITH PROPER CORS
 */
function doPost(e) {
  try {
    // Handle case where e is undefined (running from editor)
    if (!e || !e.postData) {
      return createCORSResponse({
        status: 'error',
        message: 'This function is for web form submissions'
      });
    }
    
    let data;
    
    // Parse incoming data
    if (e.postData && e.postData.type === 'application/json') {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    } else {
      return createCORSResponse({
        status: 'error',
        message: 'No data received'
      });
    }
    
    // Route to appropriate form handler
    let responseData;
    if (data.formType === 'membership') {
      responseData = handleMembershipSubmission(data);
    } else if (data.formType === 'contact') {
      responseData = handleContactSubmission(data);
    } else {
      responseData = {
        status: 'error',
        message: 'Invalid form type'
      };
    }
    
    return createCORSResponse(responseData);
    
  } catch (error) {
    console.error('Error in doPost:', error.toString());
    return createCORSResponse({
      status: 'error',
      message: 'Server error occurred',
      details: error.toString()
    });
  }
}

/**
 * OPTIONS HANDLER FOR CORS PREFLIGHT
 */
function doOptions() {
  const output = ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
  
  output.addHeader('Access-Control-Allow-Origin', ALLOWED_DOMAIN);
  output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.addHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  output.addHeader('Access-Control-Max-Age', '3600');
  
  return output;
}

/**
 * CRITICAL: Creates response with proper CORS headers
 * This is the key function that ensures CORS works
 */
function createCORSResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  
  // EXPLICITLY ADD CORS HEADERS - THIS IS CRITICAL
  output.addHeader('Access-Control-Allow-Origin', ALLOWED_DOMAIN);
  output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.addHeader('Access-Control-Allow-Headers', 'Content-Type');
  output.addHeader('Access-Control-Max-Age', '3600');
  
  return output;
}

/**
 * Handle calendar request
 */
function handleCalendarRequest() {
  try {
    // Check cache first
    const cache = CacheService.getScriptCache();
    const cacheKey = 'calendar_events';
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached calendar events');
      return {
        status: 'success',
        events: JSON.parse(cachedData),
        cached: true
      };
    }
    
    // Get calendar
    const calendar = CalendarApp.getCalendarById(GOOGLE_CALENDAR_ID);
    if (!calendar) {
      console.error('Calendar not found:', GOOGLE_CALENDAR_ID);
      return getExampleCalendarEvents();
    }
    
    // Define time range
    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    
    // Get events
    const events = calendar.getEvents(timeMin, timeMax);
    
    // Format events for FullCalendar
    const formattedEvents = events.map(event => ({
      id: event.getId(),
      title: event.getTitle(),
      start: event.getStartTime().toISOString(),
      end: event.getEndTime().toISOString(),
      description: event.getDescription() || '',
      location: event.getLocation() || '',
      allDay: event.isAllDayEvent()
    }));
    
    // Cache the formatted events
    cache.put(cacheKey, JSON.stringify(formattedEvents), CALENDAR_CACHE_MINUTES * 60);
    
    return {
      status: 'success',
      events: formattedEvents,
      cached: false,
      count: formattedEvents.length
    };
    
  } catch (error) {
    console.error('Error getting calendar:', error.toString());
    return getExampleCalendarEvents();
  }
}

/**
 * Handle gallery request
 */
function handleGalleryRequest() {
  try {
    // Check cache first
    const cache = CacheService.getScriptCache();
    const cacheKey = 'gallery_albums';
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached gallery data');
      return {
        status: 'success',
        albums: JSON.parse(cachedData),
        cached: true
      };
    }
    
    // Get fresh data from Google Drive
    const galleryFolder = DriveApp.getFolderById(GALLERY_DRIVE_FOLDER_ID);
    const albumFolders = galleryFolder.getFolders();
    const albums = [];
    
    while (albumFolders.hasNext()) {
      const folder = albumFolders.next();
      const album = processAlbumFolder(folder);
      if (album) albums.push(album);
    }
    
    // Sort albums by date (newest first)
    albums.sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));
    
    // Cache the data
    cache.put(cacheKey, JSON.stringify(albums), GALLERY_CACHE_MINUTES * 60);
    
    return {
      status: 'success',
      albums: albums,
      cached: false,
      count: albums.length
    };
    
  } catch (error) {
    console.error('Error getting gallery:', error.toString());
    return {
      status: 'error',
      message: 'Failed to load gallery',
      details: error.toString()
    };
  }
}

/**
 * Handle album photos request
 */
function handleAlbumRequest(albumId) {
  if (!albumId) {
    return {
      status: 'error',
      message: 'Album ID required'
    };
  }
  
  try {
    // Check cache first
    const cache = CacheService.getScriptCache();
    const cacheKey = `album_photos_${albumId}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached album photos');
      return {
        status: 'success',
        photos: JSON.parse(cachedData),
        cached: true
      };
    }
    
    // Get album folder
    const albumFolder = DriveApp.getFolderById(albumId);
    const files = albumFolder.getFiles();
    const photos = [];
    
    while (files.hasNext()) {
      const file = files.next();
      if (isImageFile(file)) {
        photos.push({
          id: file.getId(),
          name: file.getName(),
          url: getOptimizedImageUrl(file.getId(), 1200),
          thumbnailUrl: getOptimizedImageUrl(file.getId(), 400),
          caption: getImageCaption(file.getName()),
          dateCreated: file.getDateCreated().toISOString()
        });
      }
    }
    
    // Sort photos by date
    photos.sort((a, b) => new Date(a.dateCreated) - new Date(b.dateCreated));
    
    // Cache the data
    cache.put(cacheKey, JSON.stringify(photos), ALBUM_CACHE_MINUTES * 60);
    
    return {
      status: 'success',
      photos: photos,
      cached: false,
      count: photos.length
    };
    
  } catch (error) {
    console.error('Error getting album photos:', error.toString());
    return {
      status: 'error',
      message: 'Failed to load album photos',
      details: error.toString()
    };
  }
}

/**
 * Handle membership form submission
 */
function handleMembershipSubmission(data) {
  // Validate required fields
  if (!data.name || !data.email || !data.recaptchaToken) {
    return {
      status: 'error',
      message: 'Kõik väljad on nõutud'
    };
  }
  
  // Verify reCAPTCHA
  const scriptProperties = PropertiesService.getScriptProperties();
  const recaptchaSecretKey = scriptProperties.getProperty('RECAPTCHA_SECRET_KEY');
  const verificationResult = verifyRecaptcha(recaptchaSecretKey, data.recaptchaToken);
  
  if (!verificationResult.success) {
    return {
      status: 'error',
      message: 'Turvakontroll ebaõnnestus',
      details: verificationResult.message
    };
  }
  
  // Open membership spreadsheet
  const sheet = SpreadsheetApp.openById(MEMBERSHIP_SPREADSHEET_ID).getSheetByName(MEMBERSHIP_SHEET_NAME);
  if (!sheet) {
    return {
      status: 'error',
      message: 'Serveri seadistuse viga'
    };
  }
  
  // Check for duplicate
  const isDuplicate = checkDuplicateEmail(sheet, data.email);
  if (isDuplicate) {
    return {
      status: 'error',
      message: 'See e-posti aadress on juba registreeritud!'
    };
  }
  
  // Save membership data
  const timestamp = new Date();
  const rowData = [
    timestamp,
    data.name,
    data.email,
    verificationResult.score || 'N/A'
  ];
  
  sheet.appendRow(rowData);
  
  // Send notification email
  notifyMembershipSignup(data.name, data.email, verificationResult.score);
  
  return {
    status: 'success',
    message: 'Aitäh! Sinu liikmestaotus on vastu võetud.'
  };
}

/**
 * Handle contact form submission
 */
function handleContactSubmission(data) {
  // Validate required fields
  if (!data.name || !data.email || !data.message || !data.recaptchaToken) {
    return {
      status: 'error',
      message: 'Nimi, e-post ja sõnum on nõutud'
    };
  }
  
  // Verify reCAPTCHA
  const scriptProperties = PropertiesService.getScriptProperties();
  const recaptchaSecretKey = scriptProperties.getProperty('RECAPTCHA_SECRET_KEY');
  const verificationResult = verifyRecaptcha(recaptchaSecretKey, data.recaptchaToken);
  
  if (!verificationResult.success) {
    return {
      status: 'error',
      message: 'Turvakontroll ebaõnnestus'
    };
  }
  
  // Open contact spreadsheet
  const sheet = SpreadsheetApp.openById(CONTACT_SPREADSHEET_ID).getSheetByName(CONTACT_SHEET_NAME);
  if (!sheet) {
    return {
      status: 'error',
      message: 'Serveri seadistuse viga'
    };
  }
  
  // Save contact message
  const timestamp = new Date();
  const rowData = [
    timestamp,
    data.name,
    data.email,
    data.subject || 'Teema puudub',
    data.message,
    verificationResult.score || 'N/A'
  ];
  
  sheet.appendRow(rowData);
  
  // Send notification email
  notifyContactMessage(data.name, data.email, data.subject, data.message, verificationResult.score);
  
  return {
    status: 'success',
    message: 'Aitäh! Sinu sõnum on edastatud.'
  };
}

// ============= HELPER FUNCTIONS =============

function processAlbumFolder(folder) {
  try {
    const files = folder.getFiles();
    let coverImageId = null;
    let imageCount = 0;
    
    while (files.hasNext()) {
      const file = files.next();
      if (isImageFile(file)) {
        imageCount++;
        if (!coverImageId || file.getName().toLowerCase().includes('cover')) {
          coverImageId = file.getId();
        }
      }
    }
    
    if (imageCount === 0) return null;
    
    return {
      id: folder.getId(),
      title: folder.getName().replace(/^\d{4}-/, '').replace(/-/g, ' '),
      date: folder.getDateCreated().toLocaleDateString('et-EE'),
      description: '',
      coverImageUrl: getOptimizedImageUrl(coverImageId, 600),
      imageCount: imageCount,
      dateCreated: folder.getDateCreated().toISOString()
    };
  } catch (error) {
    console.error(`Error processing album ${folder.getName()}:`, error);
    return null;
  }
}

function isImageFile(file) {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return imageTypes.includes(file.getBlob().getContentType());
}

function getOptimizedImageUrl(fileId, size = 800) {
  return `https://drive.google.com/uc?id=${fileId}&sz=w${size}`;
}

function getImageCaption(filename) {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/^\d+[-.\s]*/, '')
    .trim();
}

function getExampleCalendarEvents() {
  const now = new Date();
  return {
    status: 'success',
    events: [
      {
        id: 'example1',
        title: 'Näidisündmus - Kogukonna koosolek',
        start: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        description: 'See on näidisündmus.',
        location: 'Kaiu Kultuurimaja',
        allDay: false
      }
    ],
    cached: false,
    example: true
  };
}

function verifyRecaptcha(secretKey, token) {
  try {
    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const response = UrlFetchApp.fetch(verificationUrl, {
      method: 'POST',
      payload: {
        secret: secretKey,
        response: token
      },
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (!result.success) {
      return {
        success: false,
        message: 'reCAPTCHA verification failed',
        errors: result['error-codes'] || []
      };
    }
    
    if (result.score !== undefined && result.score < RECAPTCHA_THRESHOLD) {
      return {
        success: false,
        message: `Score too low: ${result.score}`,
        score: result.score
      };
    }
    
    return {
      success: true,
      score: result.score
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to verify reCAPTCHA',
      error: error.toString()
    };
  }
}

function checkDuplicateEmail(sheet, email) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;
    
    const data = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
    return data.some(row => 
      row[0] && row[0].toString().toLowerCase() === email.toLowerCase()
    );
  } catch (error) {
    console.error('Error checking duplicate:', error);
    return false;
  }
}

function notifyMembershipSignup(name, email, score) {
  try {
    const recipient = 'info@kaiukodukant.ee';
    const subject = 'Uus liikmestaotus MTÜ Kaiu Kodukant';
    const body = `
      Uus liikmestaotus vastu võetud!
      
      Nimi: ${name}
      E-post: ${email}
      reCAPTCHA Score: ${score}
      Aeg: ${new Date().toLocaleString('et-EE')}
    `;
    
    GmailApp.sendEmail(recipient, subject, body);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

function notifyContactMessage(name, email, subject, message, score) {
  try {
    const recipient = 'info@kaiukodukant.ee';
    const emailSubject = 'Uus sõnum MTÜ Kaiu Kodukant kodulehelt';
    const body = `
      Uus sõnum kodulehelt vastu võetud!
      
      Nimi: ${name}
      E-post: ${email}
      Teema: ${subject}
      Sõnum: ${message}
      reCAPTCHA Score: ${score}
      Aeg: ${new Date().toLocaleString('et-EE')}
    `;
    
    GmailApp.sendEmail(recipient, emailSubject, body);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}