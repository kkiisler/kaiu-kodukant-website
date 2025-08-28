// CORS Fix for Google Apps Script
// Replace your createResponse function with this improved version

/**
 * Creates JSON response with proper CORS headers
 * IMPORTANT: This version ensures headers are properly set
 */
function createResponse(data, statusCode = 200, headers = {}) {
  // Create the JSON output
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  
  // IMPORTANT: Headers must be set using the correct method
  // Some deployments require headers to be set differently
  
  // Method 1: Direct header setting (most common)
  if (headers['Access-Control-Allow-Origin']) {
    output.addHeader('Access-Control-Allow-Origin', headers['Access-Control-Allow-Origin']);
  }
  if (headers['Access-Control-Allow-Methods']) {
    output.addHeader('Access-Control-Allow-Methods', headers['Access-Control-Allow-Methods']);
  }
  if (headers['Access-Control-Allow-Headers']) {
    output.addHeader('Access-Control-Allow-Headers', headers['Access-Control-Allow-Headers']);
  }
  
  return output;
}

/**
 * Alternative approach: Wrap all responses with CORS headers
 * Add this function and use it to wrap your doGet and doPost functions
 */
function withCORS(responseFunction) {
  return function(e) {
    // Get the response from the original function
    const response = responseFunction(e);
    
    // If it's already a ContentService output, add headers
    if (response && response.addHeader) {
      response.addHeader('Access-Control-Allow-Origin', 'https://tore.kaiukodukant.ee');
      response.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.addHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    
    return response;
  };
}

// ALTERNATIVE FIX: Simplified doGet with explicit CORS
function doGet(e) {
  try {
    const action = e.parameter.action;
    let responseData;
    
    if (action === 'calendar') {
      responseData = getCalendarData(); // Your calendar function
    } else if (action === 'gallery') {
      responseData = getGalleryAlbums(); // Your gallery function
    } else if (action === 'album') {
      const albumId = e.parameter.id;
      responseData = getAlbumPhotosData(albumId); // Your album function
    } else {
      responseData = {
        status: 'error',
        message: 'Invalid action'
      };
    }
    
    // Create response with explicit CORS headers
    const output = ContentService
      .createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
    
    // Add CORS headers explicitly
    output.addHeader('Access-Control-Allow-Origin', 'https://tore.kaiukodukant.ee');
    output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    output.addHeader('Access-Control-Allow-Headers', 'Content-Type');
    output.addHeader('Access-Control-Max-Age', '3600');
    
    return output;
    
  } catch (error) {
    // Even errors need CORS headers
    const errorOutput = ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
    
    errorOutput.addHeader('Access-Control-Allow-Origin', 'https://tore.kaiukodukant.ee');
    errorOutput.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    errorOutput.addHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return errorOutput;
  }
}

// IMPORTANT: Also add a proper OPTIONS handler
function doOptions(e) {
  const output = ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
  
  output.addHeader('Access-Control-Allow-Origin', 'https://tore.kaiukodukant.ee');
  output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.addHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  output.addHeader('Access-Control-Max-Age', '3600');
  
  return output;
}

// TEST: Direct test function to verify CORS headers
function testCORS() {
  const output = ContentService
    .createTextOutput(JSON.stringify({ test: 'CORS headers test' }))
    .setMimeType(ContentService.MimeType.JSON);
  
  output.addHeader('Access-Control-Allow-Origin', 'https://tore.kaiukodukant.ee');
  output.addHeader('Access-Control-Allow-Methods', 'GET, POST');
  output.addHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  return output;
}