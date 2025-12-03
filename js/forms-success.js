// Enhanced form handling with full form replacement on success
const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL_HERE';
const RECAPTCHA_SITE_KEY = window.RECAPTCHA_SITE_KEY || 'YOUR_RECAPTCHA_SITE_KEY_HERE';

document.addEventListener('DOMContentLoaded', function() {
    const membershipForm = document.getElementById('membership-form');
    const contactForm = document.getElementById('contact-form');
    
    // Create hidden iframe for form submission
    const iframe = document.createElement('iframe');
    iframe.name = 'forms_hidden_iframe';
    iframe.id = 'forms_hidden_iframe';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Listen for postMessage from Apps Script
    window.addEventListener('message', function(event) {
        // Optionally check origin
        if (event.origin && !event.origin.startsWith('https://script.google')) {
            return;
        }
        
        const data = event.data;
        if (!data || typeof data !== 'object' || !('ok' in data)) {
            return;
        }
        
        console.log('Received response from Apps Script:', data);
        
        const { ok, formType, message, details } = data;
        
        if (ok) {
            // Show success view
            showSuccessView(formType, message);
        } else {
            // Show error message
            showFormMessage(formType, message || 'Midagi läks valesti. Palun proovi uuesti.', 'error');
            setFormLoading(formType, false);
            if (details) {
                console.error('Form submission error details:', details);
            }
        }
    });
    
    // Setup forms
    if (membershipForm) {
        setupForm(membershipForm, 'membership');
    }
    
    if (contactForm) {
        setupForm(contactForm, 'contact');
    }
});

function setupForm(form, formType) {
    // Configure form to POST to Apps Script in hidden iframe
    form.action = GOOGLE_APPS_SCRIPT_URL;
    form.method = 'POST';
    form.target = 'forms_hidden_iframe';
    form.id = `${formType}-form`;
    
    // Add hidden field for form type
    const formTypeInput = document.createElement('input');
    formTypeInput.type = 'hidden';
    formTypeInput.name = 'formType';
    formTypeInput.value = formType;
    form.appendChild(formTypeInput);
    
    // Add hidden field for reCAPTCHA token
    const recaptchaInput = document.createElement('input');
    recaptchaInput.type = 'hidden';
    recaptchaInput.name = 'recaptchaToken';
    recaptchaInput.id = `${formType}-recaptcha-token`;
    form.appendChild(recaptchaInput);
    
    // Handle form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validate form
        if (!validateForm(form)) {
            console.log('Form validation failed');
            return false;
        }
        
        // Show loading state
        setFormLoading(formType, true);
        
        // Store form data for fallback
        const formData = new FormData(form);
        
        // Function to submit the form
        const submitForm = function() {
            console.log('Submitting form to:', form.action);
            form.submit();
            
            // Fallback: Show success after delay if postMessage doesn't work
            setTimeout(function() {
                // Only show success if still loading (postMessage didn't arrive)
                const submitBtn = document.getElementById(`${formType}-submit-btn`);
                if (submitBtn && submitBtn.disabled) {
                    console.log('Fallback: Assuming success after 3s (postMessage not received)');
                    showSuccessView(formType);
                }
            }, 3000);
        };
        
        // Check if reCAPTCHA is properly configured
        if (typeof grecaptcha !== 'undefined' && RECAPTCHA_SITE_KEY && RECAPTCHA_SITE_KEY !== 'YOUR_RECAPTCHA_SITE_KEY_HERE') {
            console.log('Getting reCAPTCHA token...');
            grecaptcha.ready(function() {
                grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: formType }).then(function(token) {
                    console.log('reCAPTCHA token received:', token.substring(0, 20) + '...');
                    
                    // Set token value
                    document.getElementById(`${formType}-recaptcha-token`).value = token;
                    
                    // Submit form
                    submitForm();
                }).catch(function(error) {
                    console.error('reCAPTCHA error:', error);
                    showFormMessage(formType, 'Turvakontroll ebaõnnestus. Palun proovi uuesti.', 'error');
                    setFormLoading(formType, false);
                });
            });
        } else {
            console.warn('reCAPTCHA not configured, submitting without token');
            
            // For testing: Add DEV_BYPASS token
            if (!RECAPTCHA_SITE_KEY || RECAPTCHA_SITE_KEY === 'YOUR_RECAPTCHA_SITE_KEY_HERE') {
                console.log('Using DEV_BYPASS token for testing');
                document.getElementById(`${formType}-recaptcha-token`).value = 'DEV_BYPASS';
            }
            
            submitForm();
        }
        
        return false;
    });
}

function showSuccessView(formType, customMessage) {
    // Find the form container
    const form = document.getElementById(`${formType}-form`);
    if (!form) return;
    
    // Find the parent container that holds the form
    const formContainer = form.closest('.form-container') || form.parentElement;
    
    // Create success message HTML
    let successTitle, successMessage, iconSvg;
    
    if (formType === 'membership') {
        successTitle = 'Täname liitumise eest!';
        successMessage = customMessage || 'Teie liikmetaotlus on edukalt esitatud. Saadame teile peagi kinnituse e-posti aadressile.';
        iconSvg = `<svg class="w-20 h-20 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`;
    } else {
        successTitle = 'Sõnum saadetud!';
        successMessage = customMessage || 'Täname, et võtsite meiega ühendust. Vastame teile esimesel võimalusel.';
        iconSvg = `<svg class="w-20 h-20 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"></path>
        </svg>`;
    }
    
    const successHTML = `
        <div class="success-view animate-fade-in text-center py-12">
            ${iconSvg}
            <h3 class="text-2xl font-bold text-gray-900 mb-4">${successTitle}</h3>
            <p class="text-gray-600 mb-8 max-w-md mx-auto">${successMessage}</p>
            <div class="flex gap-4 justify-center">
                <button onclick="location.href='/'" class="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                    Avalehele
                </button>
                <button onclick="resetForm('${formType}')" class="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    Saada uus ${formType === 'membership' ? 'taotlus' : 'sõnum'}
                </button>
            </div>
        </div>
    `;
    
    // Replace form container content with success message
    formContainer.innerHTML = successHTML;
    
    // Scroll to success message
    formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetForm(formType) {
    // Reload the page to reset the form
    // This is the simplest way to restore the original form
    location.reload();
}

function validateForm(form) {
    let isValid = true;
    
    // Get all required fields
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        const errorElement = field.parentElement.querySelector('.form-error');
        
        if (!field.value.trim()) {
            isValid = false;
            field.style.borderColor = '#ef4444';
            if (errorElement) {
                errorElement.classList.add('show');
            }
            console.log(`Validation failed for field: ${field.name}`);
        } else {
            field.style.borderColor = '#e5e7eb';
            if (errorElement) {
                errorElement.classList.remove('show');
            }
        }
        
        // Email validation
        if (field.type === 'email' && field.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(field.value)) {
                isValid = false;
                field.style.borderColor = '#ef4444';
                if (errorElement) {
                    errorElement.textContent = 'Palun sisesta korrektne e-posti aadress';
                    errorElement.classList.add('show');
                }
                console.log(`Invalid email format: ${field.value}`);
            }
        }
    });
    
    return isValid;
}

function setFormLoading(formType, isLoading) {
    const submitBtn = document.getElementById(`${formType}-submit-btn`);
    if (!submitBtn) return;
    
    if (isLoading) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Saatmine...</span><span class="spinner"></span>';
        submitBtn.style.opacity = '0.7';
    } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Saada</span>';
        submitBtn.style.opacity = '1';
    }
}

function showFormMessage(formType, message, type) {
    const messageDiv = document.getElementById(`${formType}-message`);
    if (!messageDiv) {
        // Create message div if it doesn't exist
        const form = document.getElementById(`${formType}-form`);
        if (!form) return;
        
        const newMessageDiv = document.createElement('div');
        newMessageDiv.id = `${formType}-message`;
        newMessageDiv.className = 'form-message';
        form.insertBefore(newMessageDiv, form.querySelector('.form-button'));
    }
    
    const msgDiv = document.getElementById(`${formType}-message`);
    msgDiv.textContent = message;
    msgDiv.className = `form-message ${type} show`;
    msgDiv.style.display = 'block';
    
    // Auto-hide error messages after 5 seconds
    if (type === 'error') {
        setTimeout(() => {
            msgDiv.style.display = 'none';
            msgDiv.classList.remove('show');
        }, 5000);
    }
}

// Handle field changes to clear errors
document.addEventListener('input', function(e) {
    if (e.target.classList.contains('form-input')) {
        const errorElement = e.target.parentElement.querySelector('.form-error');
        if (errorElement && e.target.value) {
            errorElement.classList.remove('show');
            e.target.style.borderColor = '#e5e7eb';
        }
    }
});