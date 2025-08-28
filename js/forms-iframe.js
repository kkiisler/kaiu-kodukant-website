// Form handling with iframe submission to avoid CORS issues
const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL_HERE';
const RECAPTCHA_SITE_KEY = window.RECAPTCHA_SITE_KEY || 'YOUR_RECAPTCHA_SITE_KEY_HERE';

document.addEventListener('DOMContentLoaded', function() {
    const membershipForm = document.getElementById('membership-form');
    const contactForm = document.getElementById('contact-form');
    
    // Create hidden iframe for form submission
    const iframe = document.createElement('iframe');
    iframe.name = 'hidden_iframe';
    iframe.id = 'hidden_iframe';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
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
    // Change form to submit to iframe
    form.action = GOOGLE_APPS_SCRIPT_URL;
    form.method = 'POST';
    form.target = 'hidden_iframe';
    
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
                    
                    // Submit form to iframe
                    form.submit();
                    
                    // Show success after delay (since we can't get response from iframe)
                    setTimeout(function() {
                        handleFormSuccess(formType, form);
                        setFormLoading(formType, false);
                    }, 2000);
                }).catch(function(error) {
                    console.error('reCAPTCHA error:', error);
                    showFormMessage(formType, 'Turvakontroll ebaõnnestus. Palun proovi uuesti.', 'error');
                    setFormLoading(formType, false);
                });
            });
        } else {
            // Submit without reCAPTCHA if not configured
            form.submit();
            
            // Show success after delay
            setTimeout(function() {
                handleFormSuccess(formType, form);
                setFormLoading(formType, false);
            }, 2000);
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