// JSONP utility for cross-origin requests to Google Apps Script
// This replaces fetch() for GET requests to avoid CORS issues

/**
 * Makes a JSONP request to bypass CORS restrictions
 * @param {string} url - The URL to request
 * @param {function} onSuccess - Success callback with response data
 * @param {function} onError - Error callback
 */
function jsonp(url, onSuccess, onError) {
    // Generate unique callback name
    const callbackName = 'jsonp_callback_' + Math.random().toString(36).substring(2, 15);
    
    // Create script element
    const script = document.createElement('script');
    
    // Setup global callback function
    window[callbackName] = function(data) {
        // Clean up
        delete window[callbackName];
        document.head.removeChild(script);
        
        // Call success callback
        if (onSuccess) {
            onSuccess(data);
        }
    };
    
    // Setup error handling
    script.onerror = function() {
        // Clean up
        delete window[callbackName];
        document.head.removeChild(script);
        
        // Call error callback
        if (onError) {
            onError(new Error('JSONP request failed'));
        }
    };
    
    // Add callback parameter to URL
    const separator = url.includes('?') ? '&' : '?';
    script.src = url + separator + 'callback=' + callbackName;
    
    // Add script to page to trigger request
    document.head.appendChild(script);
}

/**
 * Wrapper to make JSONP requests with Promise support
 * @param {string} url - The URL to request
 * @returns {Promise} Promise that resolves with response data
 */
function jsonpRequest(url) {
    return new Promise((resolve, reject) => {
        jsonp(url, resolve, reject);
    });
}