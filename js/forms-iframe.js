// Form handling with iframe POST + postMessage for real responses
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
        
        // Update form state
        setFormLoading(formType, false);
        
        if (ok) {
            // Find the form and handle success
            const form = document.getElementById(`${formType}-form`);
            if (form) {
                handleFormSuccess(formType, form);
            }
        } else {
            // Show error message
            showFormMessage(formType, message || 'Midagi läks valesti. Palun proovi uuesti.', 'error');
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
        
        // Function to submit the form
        const submitForm = function() {
            console.log('Submitting form to:', form.action);
            form.submit();
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
        submitBtn.textContent = 'Saatmine...';
        submitBtn.style.opacity = '0.7';
    } else {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Saada';
        submitBtn.style.opacity = '1';
    }
}

function handleFormSuccess(formType, form) {
    if (formType === 'membership') {
        showFormMessage(formType, 'Täname liitumise eest! Saadame teile peagi kinnituse e-posti.', 'success');
    } else {
        showFormMessage(formType, 'Täname! Teie sõnum on saadetud ja vastame esimesel võimalusel.', 'success');
    }
    
    form.reset();
    
    // Clear all field errors
    form.querySelectorAll('.form-error').forEach(error => {
        error.classList.remove('show');
    });
    form.querySelectorAll('.form-input').forEach(input => {
        input.style.borderColor = '#e5e7eb';
    });
}

function showFormMessage(formType, message, type) {
    const messageDiv = document.getElementById(`${formType}-message`);
    if (!messageDiv) return;
    
    messageDiv.textContent = message;
    messageDiv.className = `form-message ${type} show`;
    
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.classList.remove('show');
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