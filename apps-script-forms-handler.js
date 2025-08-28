// Google Apps Script - Form Handler with GET support
// Deploy this as a Web App with "Execute as: Me" and "Who has access: Anyone"

// Configuration
const CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE', // Replace with your Google Sheets ID
  MEMBERSHIP_SHEET: 'Liikmed',
  CONTACT_SHEET: 'Kontaktid',
  RECAPTCHA_SECRET: 'YOUR_RECAPTCHA_SECRET_HERE', // Replace with your reCAPTCHA secret
  ADMIN_EMAIL: 'info@kaiukodukant.ee' // Replace with your admin email
};

// Handle GET requests (for JSONP)
function doGet(e) {
  try {
    const params = e.parameter;
    const callback = params.callback;
    const formType = params.formType;
    
    // Validate callback parameter for JSONP
    if (!callback) {
      return ContentService.createTextOutput('Missing callback parameter')
        .setMimeType(ContentService.MimeType.TEXT);
    }
    
    // Process form based on type
    let result;
    if (formType === 'membership') {
      result = processMembershipForm(params);
    } else if (formType === 'contact') {
      result = processContactForm(params);
    } else {
      result = { result: 'error', message: 'Invalid form type' };
    }
    
    // Return JSONP response
    const jsonpResponse = `${callback}(${JSON.stringify(result)})`;
    return ContentService.createTextOutput(jsonpResponse)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
      
  } catch (error) {
    console.error('Error in doGet:', error);
    const errorResponse = {
      result: 'error',
      message: 'Server error occurred'
    };
    const callback = e.parameter.callback || 'callback';
    return ContentService.createTextOutput(`${callback}(${JSON.stringify(errorResponse)})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

// Handle POST requests (legacy support)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const formType = data.formType;
    
    let result;
    if (formType === 'membership') {
      result = processMembershipForm(data);
    } else if (formType === 'contact') {
      result = processContactForm(data);
    } else {
      result = { result: 'error', message: 'Invalid form type' };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error in doPost:', error);
    return ContentService.createTextOutput(JSON.stringify({
      result: 'error',
      message: 'Server error occurred'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Process membership form
function processMembershipForm(data) {
  try {
    // Verify reCAPTCHA if token provided
    if (data.recaptchaToken && CONFIG.RECAPTCHA_SECRET !== 'YOUR_RECAPTCHA_SECRET_HERE') {
      const recaptchaValid = verifyRecaptcha(data.recaptchaToken);
      if (!recaptchaValid) {
        return { result: 'error', message: 'reCAPTCHA verification failed' };
      }
    }
    
    // Open spreadsheet
    const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
      .getSheetByName(CONFIG.MEMBERSHIP_SHEET);
    
    if (!sheet) {
      // Create sheet if it doesn't exist
      const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const newSheet = spreadsheet.insertSheet(CONFIG.MEMBERSHIP_SHEET);
      newSheet.appendRow(['Timestamp', 'Nimi', 'Email', 'Telefon', 'Aadress', 'Sünnikuupäev', 'Lisainfo']);
      sheet = newSheet;
    }
    
    // Append form data
    sheet.appendRow([
      new Date(),
      data.name || '',
      data.email || '',
      data.phone || '',
      data.address || '',
      data.birthdate || '',
      data.additional || ''
    ]);
    
    // Send email notification
    if (CONFIG.ADMIN_EMAIL !== 'info@kaiukodukant.ee') {
      sendEmailNotification('membership', data);
    }
    
    return { result: 'success', message: 'Membership form submitted successfully' };
    
  } catch (error) {
    console.error('Error processing membership form:', error);
    return { result: 'error', message: 'Failed to process membership form' };
  }
}

// Process contact form
function processContactForm(data) {
  try {
    // Verify reCAPTCHA if token provided
    if (data.recaptchaToken && CONFIG.RECAPTCHA_SECRET !== 'YOUR_RECAPTCHA_SECRET_HERE') {
      const recaptchaValid = verifyRecaptcha(data.recaptchaToken);
      if (!recaptchaValid) {
        return { result: 'error', message: 'reCAPTCHA verification failed' };
      }
    }
    
    // Open spreadsheet
    const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
      .getSheetByName(CONFIG.CONTACT_SHEET);
    
    if (!sheet) {
      // Create sheet if it doesn't exist
      const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const newSheet = spreadsheet.insertSheet(CONFIG.CONTACT_SHEET);
      newSheet.appendRow(['Timestamp', 'Nimi', 'Email', 'Telefon', 'Teema', 'Sõnum']);
      sheet = newSheet;
    }
    
    // Append form data
    sheet.appendRow([
      new Date(),
      data.name || '',
      data.email || '',
      data.phone || '',
      data.subject || '',
      data.message || ''
    ]);
    
    // Send email notification
    if (CONFIG.ADMIN_EMAIL !== 'info@kaiukodukant.ee') {
      sendEmailNotification('contact', data);
    }
    
    return { result: 'success', message: 'Contact form submitted successfully' };
    
  } catch (error) {
    console.error('Error processing contact form:', error);
    return { result: 'error', message: 'Failed to process contact form' };
  }
}

// Verify reCAPTCHA token
function verifyRecaptcha(token) {
  try {
    const response = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      payload: {
        secret: CONFIG.RECAPTCHA_SECRET,
        response: token
      }
    });
    
    const result = JSON.parse(response.getContentText());
    return result.success && result.score >= 0.5;
    
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
}

// Send email notification
function sendEmailNotification(formType, data) {
  try {
    let subject, body;
    
    if (formType === 'membership') {
      subject = 'Uus liikmeavaldus - ' + data.name;
      body = `
Uus liikmeavaldus esitatud:

Nimi: ${data.name}
Email: ${data.email}
Telefon: ${data.phone}
Aadress: ${data.address}
Sünnikuupäev: ${data.birthdate}
Lisainfo: ${data.additional || 'Puudub'}

Esitatud: ${new Date().toLocaleString('et-EE')}
      `;
    } else {
      subject = 'Uus kontaktivorm - ' + data.subject;
      body = `
Uus kontaktivorm esitatud:

Nimi: ${data.name}
Email: ${data.email}
Telefon: ${data.phone || 'Ei ole esitatud'}
Teema: ${data.subject}
Sõnum: ${data.message}

Esitatud: ${new Date().toLocaleString('et-EE')}
      `;
    }
    
    MailApp.sendEmail(CONFIG.ADMIN_EMAIL, subject, body);
    
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}

// Test function
function test() {
  const testData = {
    formType: 'contact',
    name: 'Test User',
    email: 'test@example.com',
    subject: 'Test Subject',
    message: 'Test message'
  };
  
  const result = processContactForm(testData);
  console.log(result);
}