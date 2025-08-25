// Configuration
const SPREADSHEET_ID = '1g2zS5ejYclGtyQrXCnA6lBJlz7o0SmaFAnahX3g2iaU'; // !!! Your Google Spreadsheet ID !!!
const SHEET_NAME = 'Registrations'; // !!! Updated sheet name for garage sale registrations !!!
const RECAPTCHA_THRESHOLD = 0.5; // Adjust based on your reCAPTCHA needs
const RATE_LIMIT_HOURS = 1; // Hours before same phone number can submit again
const ALLOWED_DOMAIN = 'https://garaazimyyk2025.kolmekandi.ee'; // !!! Change to your specific domain (e.g., 'https://yourdomain.com') in production !!!

/**
 * Handles POST requests from the web form.
 * Receives form data and processes it, including reCAPTCHA verification and saving to Google Sheet.
 * @param {Object} e The event object containing POST request parameters.
 * @return {GoogleAppsScript.Content.TextOutput} A JSON response indicating success or failure.
 */
function doPost(e) {
  // Set CORS headers to allow requests from the client-side domain.
  // Using '*' for development flexibility, but specify your domain in production for security.
  const headers = {
    'Access-Control-Allow-Origin': ALLOWED_DOMAIN,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    let data;
    
    // Determine if data is JSON or URL-encoded form data.
    if (e.postData && e.postData.type === 'application/json') {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      // For FormData submitted via fetch, parameters are directly in e.parameter.
      data = e.parameter;
    } else {
      console.error('No data received in the request.');
      return createResponse({ 
        status: 'error', 
        message: 'No data received' 
      }, 400, headers);
    }
    
    // Validate that all expected form fields and the reCAPTCHA token are present.
    if (!data.name || !data.phone || !data.shopName || !data.address || !data.goods || !data.recaptchaToken) {
      console.log('Missing required fields in submitted data:', { 
        name: !!data.name, 
        phone: !!data.phone, 
        shopName: !!data.shopName, 
        address: !!data.address, 
        goods: !!data.goods, 
        recaptchaToken: !!data.recaptchaToken 
      });
      return createResponse({ 
        status: 'error', 
        message: 'Missing required fields' 
      }, 400, headers);
    }
    
    // Retrieve reCAPTCHA secret key from Script Properties.
    // It's crucial to set this in your Apps Script project settings for security.
    const scriptProperties = PropertiesService.getScriptProperties();
    let recaptchaSecretKey = scriptProperties.getProperty('RECAPTCHA_SECRET_KEY');
    

    
    // Verify the reCAPTCHA token with Google's API.
    const verificationResult = verifyRecaptcha(recaptchaSecretKey, data.recaptchaToken);
    
    // If reCAPTCHA verification fails (e.g., low score, invalid token), return an error.
    if (!verificationResult.success) {
      console.log('reCAPTCHA verification failed:', verificationResult);
      return createResponse({ 
        status: 'error', 
        message: 'Security verification failed',
        details: verificationResult.message
      }, 403, headers);
    }
    
    // Open the specified Google Sheet by ID and get the target sheet by name.
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    
    // Ensure the sheet exists.
    if (!sheet) {
      console.error('Sheet not found:', SHEET_NAME);
      return createResponse({ 
        status: 'error', 
        message: 'Configuration error - sheet not found' 
      }, 500, headers);
    }
    
    // Implement rate limiting based on the phone number to prevent rapid, repeated submissions.
    const rateLimitCheck = checkRateLimit(sheet, data.phone, RATE_LIMIT_HOURS);
    if (!rateLimitCheck.allowed) {
      console.log('Rate limit hit for phone number:', data.phone);
      return createResponse({ 
        status: 'error', 
        message: `See telefoninumber on hiljuti juba registreeritud. Palun proovi uuesti ${rateLimitCheck.nextAllowedTime} pärast.`
      }, 429, headers);
    }
    
    // Check for duplicate registrations based on name and phone number to prevent exact duplicate entries.
    const isDuplicate = checkDuplicateRegistration(sheet, data.name, data.phone);
    if (isDuplicate) {
      console.log('Duplicate registration submission:', data.name, data.phone);
      return createResponse({ 
        status: 'error', 
        message: 'See nimi ja telefoninumber on juba registreeritud!' 
      }, 409, headers);
    }
    
    // Prepare the row data to be appended to the Google Sheet.
    const timestamp = new Date();
    const rowData = [
      timestamp,
      data.name,
      data.phone,
      data.shopName,
      data.address,
      data.goods,
      verificationResult.score || 'N/A' // Store the reCAPTCHA score
    ];
    
    // Append the new row to the sheet.
    sheet.appendRow(rowData);
    
    console.log('Successfully saved garage sale registration:', data.name, data.phone);
    
    // Optional: Send an email notification about the new signup.
    notifyNewSignup(data.name, data.phone, data.shopName, verificationResult.score);
    
    // Return a success response to the client.
    return createResponse({ 
      status: 'success', 
      message: 'Aitäh! Sinu registreerimine on vastu võetud.',
      score: verificationResult.score
    }, 200, headers);
    
  } catch (error) {
    console.error('Error processing request:', error.toString());
    // Return a generic server error message.
    return createResponse({ 
      status: 'error', 
      message: 'Server error occurred',
      details: error.toString() // Include error details for debugging purposes (remove in production)
    }, 500, headers);
  }
}

/**
 * Verifies the reCAPTCHA token by sending it to Google's siteverify API.
 * @param {string} secretKey The reCAPTCHA secret key.
 * @param {string} token The reCAPTCHA token received from the client-side.
 * @return {Object} An object indicating verification success, score, and any errors.
 */
function verifyRecaptcha(secretKey, token) {
  try {
    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
    
    // Make a POST request to the reCAPTCHA verification endpoint.
    const response = UrlFetchApp.fetch(verificationUrl, {
      method: 'POST',
      payload: {
        secret: secretKey,
        response: token
      },
      muteHttpExceptions: true // Prevents throwing exceptions for HTTP error responses
    });
    
    const result = JSON.parse(response.getContentText());
    
    console.log('reCAPTCHA API response:', JSON.stringify(result));
    
    // Check if the overall verification was successful.
    if (!result.success) {
      return {
        success: false,
        message: 'reCAPTCHA verification failed',
        errors: result['error-codes'] || [] // Capture specific error codes from reCAPTCHA
      };
    }
    
    // For reCAPTCHA v3, evaluate the score.
    if (result.score !== undefined) {
      console.log('reCAPTCHA score:', result.score);
      
      if (result.score < RECAPTCHA_THRESHOLD) {
        return {
          success: false,
          message: `Score too low: ${result.score}`,
          score: result.score
        };
      }
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
 * Checks if a submission from the given phone number is within the defined rate limit.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The Google Sheet to check.
 * @param {string} phone The phone number to check for recent submissions.
 * @param {number} limitHours The duration in hours for the rate limit.
 * @return {Object} An object indicating if the submission is allowed and the next allowed time.
 */
function checkRateLimit(sheet, phone, limitHours) {
  try {
    const now = new Date();
    const limitTime = new Date(now.getTime() - (limitHours * 60 * 60 * 1000)); // Calculate the time threshold.
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { allowed: true }; // If sheet is empty or only has headers, allow.
    
    // Get timestamps (col 1) and phone numbers (col 3) from the sheet.
    // Adjust column index if your sheet structure changes.
    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues(); 
    
    // Iterate from the most recent entries backwards.
    for (let i = data.length - 1; i >= 0; i--) { 
      const [timestamp, , existingPhone] = data[i]; // Destructure to get timestamp and phone.
      if (existingPhone && existingPhone.toString() === phone.toString()) {
        // If a matching phone number is found within the rate limit period.
        if (new Date(timestamp) > limitTime) {
          const nextAllowedTime = new Date(new Date(timestamp).getTime() + (limitHours * 60 * 60 * 1000));
          return { 
            allowed: false, 
            nextAllowedTime: nextAllowedTime.toLocaleTimeString('et-EE') // Format for Estonian locale
          };
        }
        break; // Found the phone number, no need to check further back.
      }
    }
    
    return { allowed: true }; // No recent submission found, allow.
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return { allowed: true }; // Default to allowed in case of an error to prevent blocking legitimate users.
  }
}

/**
 * Checks for duplicate registrations based on name and phone number.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The Google Sheet to check.
 * @param {string} name The name to check.
 * @param {string} phone The phone number to check.
 * @return {boolean} True if a duplicate registration is found, false otherwise.
 */
function checkDuplicateRegistration(sheet, name, phone) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false; // No data or only headers exist.
    
    // Get all names (col 2) and phone numbers (col 3) from the sheet.
    // Adjust column indices if your sheet structure changes.
    const data = sheet.getRange(2, 2, lastRow - 1, 2).getValues(); // Gets 'name' and 'phone' columns.
    
    // Check if the combination of name and phone already exists (case-insensitive for name).
    return data.some(row => 
      row[0] && row[0].toString().toLowerCase() === name.toLowerCase() &&
      row[1] && row[1].toString() === phone.toString()
    );
  } catch (error) {
    console.error('Error checking for duplicate registration:', error);
    return false; // Default to no duplicate in case of an error.
  }
}

/**
 * Creates a JSON response object for the client.
 * @param {Object} data The data to be sent in the JSON response.
 * @param {number} statusCode The HTTP status code (used for logging/context, not directly set by ContentService).
 * @param {Object} headers HTTP headers to include in the response.
 * @return {GoogleAppsScript.Content.TextOutput} The response object.
 */
function createResponse(data, statusCode = 200, headers = {}) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(headers);
}

/**
 * Handles OPTIONS requests (preflight requests for CORS).
 * Allows cross-origin requests by setting appropriate headers.
 * @param {Object} e The event object.
 * @return {GoogleAppsScript.Content.TextOutput} An empty text output with CORS headers.
 */
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': ALLOWED_DOMAIN,
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600' // Cache preflight response for 1 hour
    });
}

/**
 * Sends an email notification to the organizer about a new registration.
 * This function is optional and requires GmailApp permissions in your Apps Script project.
 * @param {string} name The name of the registrant.
 * @param {string} phone The phone number of the registrant.
 * @param {string} shopName The name of the seller's spot.
 * @param {number} score The reCAPTCHA score for the submission.
 */
function notifyNewSignup(name, phone, shopName, score) {
  try {
    // !!! IMPORTANT: Replace 'your_organizer_email@example.com' with the actual recipient email. !!!
    const recipient = 'kaur@amanda.sh'; 
    const subject = 'Uus registreerimine Garaažimüügile!';
    const body = `
      Uus registreerimine vastu võetud!
      
      Nimi: ${name}
      Telefon: ${phone}
      Müügikoha nimi: ${shopName}
      reCAPTCHA Score: ${score}
      Aeg: ${new Date().toLocaleString('et-EE')}
      
      Koguarv registreerimisi: ${SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME).getLastRow() - 1}
    `;
    
    // Send the email. Requires 'GmailApp' service enabled in Apps Script project settings.
    GmailApp.sendEmail(recipient, subject, body);
    
  } catch (error) {
    console.error('Error sending notification email:', error);
  }
}

// NOTE: getSignupStats, exportEmails, and testSetup functions from the original script
// have been removed or commented out as they are not directly applicable to the
// new garage sale registration form's data structure and purpose.
// If you need statistics or export features, they would need to be re-implemented
// specifically for the new form fields (Name, Phone, Shop Name, Address, Goods).
