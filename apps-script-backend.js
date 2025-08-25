// MTÜ Kaiu Kodukant Forms Backend - Google Apps Script
// This script handles both membership registration and contact form submissions

// Configuration
const MEMBERSHIP_SPREADSHEET_ID = 'YOUR_MEMBERSHIP_SPREADSHEET_ID'; // !!! Replace with your Google Spreadsheet ID !!!
const CONTACT_SPREADSHEET_ID = 'YOUR_CONTACT_SPREADSHEET_ID'; // !!! Replace with your Google Spreadsheet ID !!!
const MEMBERSHIP_SHEET_NAME = 'Liikmed'; // Membership registrations
const CONTACT_SHEET_NAME = 'Sõnumid'; // Contact messages
const RECAPTCHA_THRESHOLD = 0.5; // Adjust based on your reCAPTCHA needs
const RATE_LIMIT_HOURS = 1; // Hours before same email can submit again
const ALLOWED_DOMAIN = 'https://yourdomain.com'; // !!! Change to your domain in production !!!

// Google Calendar Configuration
const GOOGLE_CALENDAR_ID = '3ab658c2becd62b9af62343da736243b73e1d56523c7c04b8ed46d944eb0e8fb@group.calendar.google.com'; // Your calendar ID
const CALENDAR_CACHE_MINUTES = 15; // Cache calendar data for 15 minutes

// Google Drive Gallery Configuration
const GALLERY_DRIVE_FOLDER_ID = 'YOUR_GALLERY_FOLDER_ID'; // !!! Replace with your Google Drive gallery folder ID !!!
const GALLERY_CACHE_MINUTES = 30; // Cache gallery albums for 30 minutes
const ALBUM_CACHE_MINUTES = 60; // Cache album photos for 60 minutes

/**
 * Handles POST requests from web forms
 * Routes to appropriate handler based on form type
 */
function doPost(e) {
  const headers = {
    'Access-Control-Allow-Origin': ALLOWED_DOMAIN,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    let data;
    
    // Parse incoming data
    if (e.postData && e.postData.type === 'application/json') {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    } else {
      console.error('No data received in the request.');
      return createResponse({ 
        status: 'error', 
        message: 'No data received' 
      }, 400, headers);
    }
    
    // Route to appropriate form handler based on form type
    if (data.formType === 'membership') {
      return handleMembershipForm(data, headers);
    } else if (data.formType === 'contact') {
      return handleContactForm(data, headers);
    } else {
      return createResponse({ 
        status: 'error', 
        message: 'Invalid form type' 
      }, 400, headers);
    }
    
  } catch (error) {
    console.error('Error processing request:', error.toString());
    return createResponse({ 
      status: 'error', 
      message: 'Server error occurred',
      details: error.toString()
    }, 500, headers);
  }
}

/**
 * Handles membership form submissions
 */
function handleMembershipForm(data, headers) {
  // Validate required fields for membership
  if (!data.name || !data.email || !data.recaptchaToken) {
    console.log('Missing required fields for membership:', { 
      name: !!data.name, 
      email: !!data.email, 
      recaptchaToken: !!data.recaptchaToken 
    });
    return createResponse({ 
      status: 'error', 
      message: 'Kõik väljad on nõutud' 
    }, 400, headers);
  }
  
  // Verify reCAPTCHA
  const scriptProperties = PropertiesService.getScriptProperties();
  const recaptchaSecretKey = scriptProperties.getProperty('RECAPTCHA_SECRET_KEY');
  const verificationResult = verifyRecaptcha(recaptchaSecretKey, data.recaptchaToken);
  
  if (!verificationResult.success) {
    console.log('reCAPTCHA verification failed:', verificationResult);
    return createResponse({ 
      status: 'error', 
      message: 'Turvakontroll ebaõnnestus',
      details: verificationResult.message
    }, 403, headers);
  }
  
  // Open membership spreadsheet
  const sheet = SpreadsheetApp.openById(MEMBERSHIP_SPREADSHEET_ID).getSheetByName(MEMBERSHIP_SHEET_NAME);
  if (!sheet) {
    console.error('Membership sheet not found:', MEMBERSHIP_SHEET_NAME);
    return createResponse({ 
      status: 'error', 
      message: 'Serveri seadistuse viga' 
    }, 500, headers);
  }
  
  // Check for duplicate membership
  const isDuplicate = checkDuplicateEmail(sheet, data.email);
  if (isDuplicate) {
    console.log('Duplicate membership submission:', data.email);
    return createResponse({ 
      status: 'error', 
      message: 'See e-posti aadress on juba registreeritud!' 
    }, 409, headers);
  }
  
  // Rate limiting check
  const rateLimitCheck = checkRateLimit(sheet, data.email, RATE_LIMIT_HOURS);
  if (!rateLimitCheck.allowed) {
    console.log('Rate limit hit for email:', data.email);
    return createResponse({ 
      status: 'error', 
      message: `See e-posti aadress on hiljuti juba registreeritud. Palun proovi uuesti ${rateLimitCheck.nextAllowedTime} pärast.`
    }, 429, headers);
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
  
  console.log('Successfully saved membership:', data.name, data.email);
  
  // Send notification email
  notifyMembershipSignup(data.name, data.email, verificationResult.score);
  
  return createResponse({ 
    status: 'success', 
    message: 'Aitäh! Sinu liikmestaotus on vastu võetud. Juhatus vaatab taotluse üle ja kinnitab liikmeks astumise e-posti teel.'
  }, 200, headers);
}

/**
 * Handles contact form submissions
 */
function handleContactForm(data, headers) {
  // Validate required fields for contact
  if (!data.name || !data.email || !data.message || !data.recaptchaToken) {
    console.log('Missing required fields for contact:', { 
      name: !!data.name, 
      email: !!data.email, 
      message: !!data.message,
      recaptchaToken: !!data.recaptchaToken 
    });
    return createResponse({ 
      status: 'error', 
      message: 'Nimi, e-post ja sõnum on nõutud' 
    }, 400, headers);
  }
  
  // Verify reCAPTCHA
  const scriptProperties = PropertiesService.getScriptProperties();
  const recaptchaSecretKey = scriptProperties.getProperty('RECAPTCHA_SECRET_KEY');
  const verificationResult = verifyRecaptcha(recaptchaSecretKey, data.recaptchaToken);
  
  if (!verificationResult.success) {
    console.log('reCAPTCHA verification failed:', verificationResult);
    return createResponse({ 
      status: 'error', 
      message: 'Turvakontroll ebaõnnestus'
    }, 403, headers);
  }
  
  // Open contact spreadsheet
  const sheet = SpreadsheetApp.openById(CONTACT_SPREADSHEET_ID).getSheetByName(CONTACT_SHEET_NAME);
  if (!sheet) {
    console.error('Contact sheet not found:', CONTACT_SHEET_NAME);
    return createResponse({ 
      status: 'error', 
      message: 'Serveri seadistuse viga' 
    }, 500, headers);
  }
  
  // Rate limiting check for contact messages
  const rateLimitCheck = checkRateLimit(sheet, data.email, RATE_LIMIT_HOURS);
  if (!rateLimitCheck.allowed) {
    console.log('Rate limit hit for contact email:', data.email);
    return createResponse({ 
      status: 'error', 
      message: `See e-posti aadress on hiljuti juba sõnumi saatnud. Palun proovi uuesti ${rateLimitCheck.nextAllowedTime} pärast.`
    }, 429, headers);
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
  
  console.log('Successfully saved contact message:', data.name, data.email);
  
  // Send notification email
  notifyContactMessage(data.name, data.email, data.subject, data.message, verificationResult.score);
  
  return createResponse({ 
    status: 'success', 
    message: 'Aitäh! Sinu sõnum on edastatud. Võtame Sinuga peatselt ühendust.'
  }, 200, headers);
}

/**
 * Verifies reCAPTCHA token
 */
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
    console.log('reCAPTCHA API response:', JSON.stringify(result));
    
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
      score: result.score,
      action: result.action,
      challenge_ts: result.challenge_ts,
      hostname: result.hostname
    };
    
  } catch (error) {
    console.error('Error during reCAPTCHA verification:', error.toString());
    return {
      success: false,
      message: 'Failed to verify reCAPTCHA',
      error: error.toString()
    };
  }
}

/**
 * Checks rate limiting based on email
 */
function checkRateLimit(sheet, email, limitHours) {
  try {
    const now = new Date();
    const limitTime = new Date(now.getTime() - (limitHours * 60 * 60 * 1000));
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { allowed: true };
    
    // Get timestamps (col 1) and emails (col 3) from the sheet
    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    
    // Check from most recent entries backwards
    for (let i = data.length - 1; i >= 0; i--) {
      const [timestamp, , existingEmail] = data[i];
      if (existingEmail && existingEmail.toString().toLowerCase() === email.toLowerCase()) {
        if (new Date(timestamp) > limitTime) {
          const nextAllowedTime = new Date(new Date(timestamp).getTime() + (limitHours * 60 * 60 * 1000));
          return { 
            allowed: false, 
            nextAllowedTime: nextAllowedTime.toLocaleTimeString('et-EE')
          };
        }
        break;
      }
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return { allowed: true };
  }
}

/**
 * Checks for duplicate email addresses
 */
function checkDuplicateEmail(sheet, email) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;
    
    // Get all emails (assuming they're in column 3)
    const data = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
    
    return data.some(row => 
      row[0] && row[0].toString().toLowerCase() === email.toLowerCase()
    );
  } catch (error) {
    console.error('Error checking for duplicate email:', error);
    return false;
  }
}

/**
 * Creates JSON response
 */
function createResponse(data, statusCode = 200, headers = {}) {
  // statusCode is kept for compatibility but not used by ContentService
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(headers);
}

/**
 * Handles OPTIONS requests for CORS
 */
function doOptions() {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': ALLOWED_DOMAIN,
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600'
    });
}

/**
 * Sends notification for new membership
 */
function notifyMembershipSignup(name, email, score) {
  try {
    const recipient = 'info@kaiukodukant.ee'; // !!! Replace with actual recipient !!!
    const subject = 'Uus liikmestaotus MTÜ Kaiu Kodukant';
    const body = `
      Uus liikmestaotus vastu võetud!
      
      Nimi: ${name}
      E-post: ${email}
      reCAPTCHA Score: ${score}
      Aeg: ${new Date().toLocaleString('et-EE')}
      
      Koguarv taotlusi: ${SpreadsheetApp.openById(MEMBERSHIP_SPREADSHEET_ID).getSheetByName(MEMBERSHIP_SHEET_NAME).getLastRow() - 1}
    `;
    
    GmailApp.sendEmail(recipient, subject, body);
    
  } catch (error) {
    console.error('Error sending membership notification email:', error);
  }
}

/**
 * Sends notification for new contact message
 */
function notifyContactMessage(name, email, subject, message, score) {
  try {
    const recipient = 'info@kaiukodukant.ee'; // !!! Replace with actual recipient !!!
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
    console.error('Error sending contact notification email:', error);
  }
}

/**
 * Handles GET requests for calendar data and gallery data
 */
function doGet(e) {
  const headers = {
    'Access-Control-Allow-Origin': ALLOWED_DOMAIN,
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  try {
    const action = e.parameter.action;
    
    if (action === 'calendar') {
      return getCalendarEvents(headers);
    } else if (action === 'gallery') {
      return getGalleryData(headers);
    } else if (action === 'album') {
      const albumId = e.parameter.id;
      if (!albumId) {
        return createResponse({ 
          status: 'error', 
          message: 'Album ID required' 
        }, 400, headers);
      }
      return getAlbumPhotos(albumId, headers);
    } else {
      return createResponse({ 
        status: 'error', 
        message: 'Invalid action' 
      }, 400, headers);
    }
    
  } catch (error) {
    console.error('Error processing GET request:', error.toString());
    return createResponse({ 
      status: 'error', 
      message: 'Server error occurred',
      details: error.toString()
    }, 500, headers);
  }
}

/**
 * Gets gallery albums from Google Drive with caching
 */
function getGalleryData(headers) {
  try {
    // Check cache first
    const cache = CacheService.getScriptCache();
    const cacheKey = 'gallery_albums';
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached gallery data');
      return createResponse({
        status: 'success',
        albums: JSON.parse(cachedData),
        cached: true
      }, 200, headers);
    }
    
    // Check if gallery folder is configured
    if (GALLERY_DRIVE_FOLDER_ID === 'YOUR_GALLERY_FOLDER_ID') {
      console.warn('Gallery folder not configured');
      return getExampleGalleryData(headers);
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
    console.log(`Cached ${albums.length} gallery albums for ${GALLERY_CACHE_MINUTES} minutes`);
    
    return createResponse({
      status: 'success',
      albums: albums,
      cached: false,
      count: albums.length
    }, 200, headers);
    
  } catch (error) {
    console.error('Error getting gallery data:', error.toString());
    return createResponse({
      status: 'error',
      message: 'Failed to load gallery albums',
      details: error.toString()
    }, 500, headers);
  }
}

/**
 * Gets photos from a specific album folder
 */
function getAlbumPhotos(folderId, headers) {
  try {
    // Check cache first
    const cache = CacheService.getScriptCache();
    const cacheKey = `album_photos_${folderId}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached album photos');
      return createResponse({
        status: 'success',
        photos: JSON.parse(cachedData),
        cached: true
      }, 200, headers);
    }
    
    // Get album folder
    const albumFolder = DriveApp.getFolderById(folderId);
    const files = albumFolder.getFiles();
    const photos = [];
    
    while (files.hasNext()) {
      const file = files.next();
      if (isImageFile(file)) {
        photos.push({
          id: file.getId(),
          name: file.getName(),
          url: getOptimizedImageUrl(file.getId(), 1200), // Full size
          thumbnailUrl: getOptimizedImageUrl(file.getId(), 400), // Thumbnail
          caption: getImageCaption(file.getName()),
          dateCreated: file.getDateCreated().toISOString()
        });
      }
    }
    
    // Sort photos by date created
    photos.sort((a, b) => new Date(a.dateCreated) - new Date(b.dateCreated));
    
    // Cache the data
    cache.put(cacheKey, JSON.stringify(photos), ALBUM_CACHE_MINUTES * 60);
    console.log(`Cached ${photos.length} photos for album ${folderId}`);
    
    return createResponse({
      status: 'success',
      photos: photos,
      cached: false,
      count: photos.length
    }, 200, headers);
    
  } catch (error) {
    console.error('Error getting album photos:', error.toString());
    return createResponse({
      status: 'error',
      message: 'Failed to load album photos',
      details: error.toString()
    }, 500, headers);
  }
}

/**
 * Processes a single album folder to extract metadata
 */
function processAlbumFolder(folder) {
  try {
    const files = folder.getFiles();
    let coverImageId = null;
    let imageCount = 0;
    let albumInfo = null;
    
    // Look for cover image, count images, and get info
    while (files.hasNext()) {
      const file = files.next();
      
      if (isImageFile(file)) {
        imageCount++;
        // Use first image as cover if no specific cover.jpg found
        if (!coverImageId || file.getName().toLowerCase().includes('cover')) {
          coverImageId = file.getId();
        }
      } else if (file.getName().toLowerCase() === 'info.txt') {
        albumInfo = file.getBlob().getDataAsString();
      }
    }
    
    // Skip folders with no images
    if (imageCount === 0) {
      console.log(`Skipping folder ${folder.getName()} - no images found`);
      return null;
    }
    
    // Parse album info (date and description)
    let albumDate = folder.getDateCreated().toLocaleDateString('et-EE');
    let albumDescription = '';
    
    if (albumInfo) {
      const lines = albumInfo.split('\n');
      if (lines.length > 0 && lines[0].trim()) albumDate = lines[0].trim();
      if (lines.length > 1) albumDescription = lines.slice(1).join('\n').trim();
    }
    
    return {
      id: folder.getId(),
      title: folder.getName().replace(/^\d{4}-/, '').replace(/-/g, ' '), // Clean up folder name
      date: albumDate,
      description: albumDescription,
      coverImageUrl: getOptimizedImageUrl(coverImageId, 600),
      imageCount: imageCount,
      dateCreated: folder.getDateCreated().toISOString()
    };
    
  } catch (error) {
    console.error(`Error processing album folder ${folder.getName()}:`, error);
    return null;
  }
}

/**
 * Checks if a file is an image
 */
function isImageFile(file) {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return imageTypes.includes(file.getBlob().getContentType());
}

/**
 * Generates optimized Google Drive image URL with size parameter
 */
function getOptimizedImageUrl(fileId, size = 800) {
  return `https://drive.google.com/uc?id=${fileId}&sz=w${size}`;
}

/**
 * Extracts caption from filename (removes extension and cleans up)
 */
function getImageCaption(filename) {
  return filename
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
    .replace(/^\d+[-.\s]*/, '') // Remove leading numbers
    .trim();
}

/**
 * Returns example gallery data when Drive folder is not configured
 */
function getExampleGalleryData(headers) {
  const exampleAlbums = [
    {
      id: 'example1',
      title: 'Suvefestival 2024 (Näidis)',
      date: '15. juuli 2024',
      description: 'Traditsioonilne suvefestival kogu perele',
      coverImageUrl: 'https://placehold.co/600x400/cfcabe/111111?text=Suvefestival',
      imageCount: 8
    },
    {
      id: 'example2',
      title: 'Kevadkorrastus 2024 (Näidis)',
      date: '20. aprill 2024',
      description: 'Kogukonna ühine kevadkorrastus',
      coverImageUrl: 'https://placehold.co/600x400/cfcabe/111111?text=Kevadkorrastus',
      imageCount: 12
    }
  ];
  
  return createResponse({
    status: 'success',
    albums: exampleAlbums,
    cached: false,
    example: true
  }, 200, headers);
}

/**
 * Clears all gallery caches (useful for manual refresh)
 */
function clearGalleryCaches() {
  const cache = CacheService.getScriptCache();
  cache.remove('gallery_albums');
  
  // Clear album photo caches (this is a bit brute force, but effective)
  const keys = cache.getAll({});
  Object.keys(keys).forEach(key => {
    if (key.startsWith('album_photos_')) {
      cache.remove(key);
    }
  });
  
  console.log('All gallery caches cleared');
}

/**
 * Clears the calendar cache (useful for manual refresh)
 */
function clearCalendarCache() {
  const cache = CacheService.getScriptCache();
  cache.remove('calendar_events');
  console.log('Calendar cache cleared');
}