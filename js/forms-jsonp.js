// Form handling with JSONP submission to avoid CORS issues
const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL_HERE';
const RECAPTCHA_SITE_KEY = window.RECAPTCHA_SITE_KEY || 'YOUR_RECAPTCHA_SITE_KEY_HERE';

document.addEventListener('DOMContentLoaded', function() {
    const membershipForm = document.getElementById('membership-form');
    const contactForm = document.getElementById('contact-form');
    
    // Setup membership form
    if (membershipForm) {
        setupForm(membershipForm, 'membership');
    }
    
    // Setup contact form
    if (contactForm) {
        setupForm(contactForm, 'contact');
    }
});

function setupForm(form, formType) {
    // We'll use GET request with parameters instead of POST
    // to avoid 403 errors from Google Apps Script
    
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
            return false;
        }
        
        // Show loading state
        setFormLoading(formType, true);
        
        // Get reCAPTCHA token if available
        if (typeof grecaptcha !== 'undefined' && RECAPTCHA_SITE_KEY !== 'YOUR_RECAPTCHA_SITE_KEY_HERE') {
            grecaptcha.ready(function() {
                grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: formType }).then(function(token) {
                    // Set token value
                    document.getElementById(`${formType}-recaptcha-token`).value = token;
                    
                    // Build URL with GET parameters
                    const formData = new FormData(form);
                    const params = new URLSearchParams();
                    for (let [key, value] of formData.entries()) {
                        params.append(key, value);
                    }
                    
                    // Use JSONP for submission to avoid CORS
                    submitFormViaJsonp(params.toString(), formType, form);
                }).catch(function(error) {
                    console.error('reCAPTCHA error:', error);
                    showFormMessage(formType, 'Turvakontroll ebaõnnestus. Palun proovi uuesti.', 'error');
                    setFormLoading(formType, false);
                });
            });
        } else {
            // Submit without reCAPTCHA if not configured
            const formData = new FormData(form);
            const params = new URLSearchParams();
            for (let [key, value] of formData.entries()) {
                params.append(key, value);
            }
            
            // Use JSONP for submission
            submitFormViaJsonp(params.toString(), formType, form);
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

// Submit form via JSONP to avoid CORS issues
function submitFormViaJsonp(params, formType, form) {
    const callbackName = 'formCallback_' + Math.random().toString(36).substring(2, 15);
    
    // Create callback function
    window[callbackName] = function(response) {
        // Clean up
        delete window[callbackName];
        const script = document.getElementById(callbackName + '_script');
        if (script) {
            document.head.removeChild(script);
        }
        
        // Handle response
        if (response && response.result === 'success') {
            handleFormSuccess(formType, form);
        } else {
            showFormMessage(formType, response?.message || 'Midagi läks valesti. Palun proovi uuesti.', 'error');
        }
        setFormLoading(formType, false);
    };
    
    // Create script tag for JSONP request
    const script = document.createElement('script');
    script.id = callbackName + '_script';
    script.src = `${GOOGLE_APPS_SCRIPT_URL}?${params}&callback=${callbackName}`;
    
    // Handle errors
    script.onerror = function() {
        delete window[callbackName];
        if (script.parentNode) {
            document.head.removeChild(script);
        }
        showFormMessage(formType, 'Ühendus serveriga ebaõnnestus. Palun proovi uuesti.', 'error');
        setFormLoading(formType, false);
    };
    
    // Add timeout
    setTimeout(function() {
        if (window[callbackName]) {
            delete window[callbackName];
            if (script.parentNode) {
                document.head.removeChild(script);
            }
            showFormMessage(formType, 'Päring aegus. Palun proovi uuesti.', 'error');
            setFormLoading(formType, false);
        }
    }, 15000);
    
    document.head.appendChild(script);
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