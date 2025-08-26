// Form handling functionality

// Form configuration - Replace with your actual URLs
const GOOGLE_APPS_SCRIPT_URL = 'YOUR_DEPLOYED_APPS_SCRIPT_URL';
const RECAPTCHA_SITE_KEY = 'YOUR_RECAPTCHA_SITE_KEY';

document.addEventListener('DOMContentLoaded', function() {
    initializeForms();
});

function initializeForms() {
    // Membership form
    const membershipForm = document.getElementById('membership-form');
    if (membershipForm) {
        membershipForm.addEventListener('submit', function(e) {
            handleFormSubmit(e, 'membership', membershipForm);
        });
    }
    
    // Contact form
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            handleFormSubmit(e, 'contact', contactForm);
        });
    }
}

function handleFormSubmit(event, formType, form) {
    event.preventDefault();
    
    // Validate form
    if (!validateForm(form)) {
        return;
    }
    
    // Show loading state
    setFormLoading(formType, true);
    clearFormMessage(formType);
    
    // Execute reCAPTCHA and submit
    if (typeof grecaptcha !== 'undefined' && RECAPTCHA_SITE_KEY !== 'YOUR_RECAPTCHA_SITE_KEY') {
        grecaptcha.ready(function() {
            grecaptcha.execute(RECAPTCHA_SITE_KEY, {action: 'submit_form'}).then(function(token) {
                submitFormData(formType, form, token);
            }).catch(function(error) {
                console.error('reCAPTCHA error:', error);
                showFormMessage(formType, 'Turvakontroll ebaõnnestus. Palun proovi lehte uuesti laadida.', 'error');
                setFormLoading(formType, false);
            });
        });
    } else {
        // If reCAPTCHA is not configured, show error
        showFormMessage(formType, 'Vorm pole õigesti seadistatud. Palun võta ühendust administraatoriga.', 'error');
        setFormLoading(formType, false);
    }
}

function validateForm(form) {
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        const errorElement = field.parentNode.querySelector('.form-error');
        
        if (!field.value.trim()) {
            isValid = false;
            if (errorElement) {
                errorElement.classList.add('show');
            }
            field.style.borderColor = '#dc2626';
        } else if (field.type === 'email' && !isValidEmail(field.value)) {
            isValid = false;
            if (errorElement) {
                errorElement.textContent = 'Palun sisesta kehtiv e-posti aadress.';
                errorElement.classList.add('show');
            }
            field.style.borderColor = '#dc2626';
        } else {
            if (errorElement) {
                errorElement.classList.remove('show');
            }
            field.style.borderColor = '#e5e7eb';
        }
    });
    
    return isValid;
}

function isValidEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email.toLowerCase());
}

async function submitFormData(formType, form, token) {
    const formData = new FormData(form);
    const data = {
        action: formType,
        token: token,
        data: Object.fromEntries(formData),
        timestamp: new Date().toISOString()
    };
    
    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            handleFormSuccess(formType, form);
        } else {
            throw new Error(result.message || 'Vormi saatmine ebaõnnestus');
        }
        
    } catch (error) {
        console.error('Form submission error:', error);
        showFormMessage(formType, 'Vormi saatmine ebaõnnestus. Palun proovi hiljem uuesti.', 'error');
    } finally {
        setFormLoading(formType, false);
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

function setFormLoading(formType, isLoading) {
    const button = document.querySelector(`#${formType}-form button[type="submit"]`);
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        const originalText = button.textContent;
        button.setAttribute('data-original-text', originalText);
        button.innerHTML = `${originalText}<div class="spinner"></div>`;
    } else {
        button.disabled = false;
        const originalText = button.getAttribute('data-original-text');
        if (originalText) {
            button.textContent = originalText;
        }
    }
}

function showFormMessage(formType, message, type) {
    const form = document.getElementById(`${formType}-form`);
    if (!form) return;
    
    // Remove existing message
    const existingMessage = form.querySelector('.form-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create new message
    const messageEl = document.createElement('div');
    messageEl.className = `form-message ${type}`;
    messageEl.textContent = message;
    form.appendChild(messageEl);
    
    // Auto-hide error messages after 10 seconds
    if (type === 'error') {
        setTimeout(() => {
            messageEl.remove();
        }, 10000);
    }
}

function clearFormMessage(formType) {
    const form = document.getElementById(`${formType}-form`);
    if (!form) return;
    
    const message = form.querySelector('.form-message');
    if (message) {
        message.remove();
    }
}