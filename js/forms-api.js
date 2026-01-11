// Form handling with new API backend
// This replaces the Google Apps Script submission with Node.js API

// Get configuration from config.js
const API_BASE_URL = window.API_BASE_URL || 'https://api.kaiukodukant.ee';
const RECAPTCHA_SITE_KEY = window.RECAPTCHA_SITE_KEY || 'YOUR_RECAPTCHA_SITE_KEY';

// Initialize forms when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeForms();
});

function initializeForms() {
    // Check if reCAPTCHA is configured
    if (!RECAPTCHA_SITE_KEY || RECAPTCHA_SITE_KEY === 'YOUR_RECAPTCHA_SITE_KEY') {
        console.warn('reCAPTCHA not configured - forms will work without it');
    } else {
        // Load reCAPTCHA script
        loadRecaptcha();
    }

    // Initialize membership form
    const membershipForm = document.getElementById('membership-form');
    if (membershipForm) {
        initializeMembershipForm(membershipForm);
    }

    // Initialize contact form
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        initializeContactForm(contactForm);
    }
}

function loadRecaptcha() {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

function initializeMembershipForm(form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const submitBtn = document.getElementById('membership-submit-btn');
        const messageDiv = document.getElementById('membership-message');

        // Disable submit button
        setLoadingState(submitBtn, true);
        hideMessage(messageDiv);

        // Get form data
        const memberTypeInput = form.querySelector('input[name="memberType"]:checked');
        const formData = {
            name: form.querySelector('#member-name').value.trim(),
            email: form.querySelector('#member-email').value.trim(),
            memberType: memberTypeInput ? memberTypeInput.value : ''
        };

        // Validate
        if (!validateMembershipForm(formData)) {
            setLoadingState(submitBtn, false);
            return;
        }

        try {
            // Get reCAPTCHA token if configured
            if (window.grecaptcha && RECAPTCHA_SITE_KEY !== 'YOUR_RECAPTCHA_SITE_KEY') {
                formData.recaptchaToken = await grecaptcha.execute(RECAPTCHA_SITE_KEY, {
                    action: 'membership'
                });
            }

            // Submit to API
            const response = await fetch(`${API_BASE_URL}/api/v1/submit/membership`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Success
                showMessage(messageDiv, result.message || 'Taotlus edukalt esitatud!', 'success');
                form.reset();
            } else {
                // Error
                showMessage(messageDiv, result.message || 'Midagi läks valesti. Palun proovi uuesti.', 'error');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            showMessage(messageDiv, 'Ühenduse viga. Palun kontrolli internetiühendust ja proovi uuesti.', 'error');
        } finally {
            setLoadingState(submitBtn, false);
        }
    });
}

function initializeContactForm(form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const submitBtn = document.getElementById('contact-submit-btn');
        const messageDiv = document.getElementById('contact-message');

        // Disable submit button
        setLoadingState(submitBtn, true);
        hideMessage(messageDiv);

        // Get form data
        const formData = {
            name: form.querySelector('#contact-name').value.trim(),
            email: form.querySelector('#contact-email').value.trim(),
            subject: form.querySelector('#contact-subject')?.value.trim() || '',
            message: form.querySelector('#contact-msg').value.trim()
        };

        // Validate
        if (!validateContactForm(formData)) {
            setLoadingState(submitBtn, false);
            return;
        }

        try {
            // Get reCAPTCHA token if configured
            if (window.grecaptcha && RECAPTCHA_SITE_KEY !== 'YOUR_RECAPTCHA_SITE_KEY') {
                formData.recaptchaToken = await grecaptcha.execute(RECAPTCHA_SITE_KEY, {
                    action: 'contact'
                });
            }

            // Submit to API
            const response = await fetch(`${API_BASE_URL}/api/v1/submit/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Success
                showMessage(messageDiv, result.message || 'Sõnum edukalt saadetud!', 'success');
                form.reset();
            } else {
                // Error
                showMessage(messageDiv, result.message || 'Midagi läks valesti. Palun proovi uuesti.', 'error');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            showMessage(messageDiv, 'Ühenduse viga. Palun kontrolli internetiühendust ja proovi uuesti.', 'error');
        } finally {
            setLoadingState(submitBtn, false);
        }
    });
}

function validateMembershipForm(data) {
    let isValid = true;

    // Validate member type
    const memberTypeError = document.getElementById('memberType-error');
    const memberTypeContainer = memberTypeError?.previousElementSibling;
    if (!data.memberType) {
        if (memberTypeError) memberTypeError.style.display = 'block';
        if (memberTypeContainer) memberTypeContainer.classList.add('form-input-error');
        isValid = false;
    } else {
        if (memberTypeError) memberTypeError.style.display = 'none';
        if (memberTypeContainer) memberTypeContainer.classList.remove('form-input-error');
    }

    // Validate name
    const nameInput = document.getElementById('member-name');
    const nameError = nameInput.nextElementSibling;
    if (!data.name || data.name.length < 2) {
        nameError.style.display = 'block';
        nameInput.classList.add('form-input-error');
        isValid = false;
    } else {
        nameError.style.display = 'none';
        nameInput.classList.remove('form-input-error');
    }

    // Validate email
    const emailInput = document.getElementById('member-email');
    const emailError = emailInput.nextElementSibling;
    if (!isValidEmail(data.email)) {
        emailError.style.display = 'block';
        emailInput.classList.add('form-input-error');
        isValid = false;
    } else {
        emailError.style.display = 'none';
        emailInput.classList.remove('form-input-error');
    }

    return isValid;
}

function validateContactForm(data) {
    let isValid = true;

    // Validate name
    const nameInput = document.getElementById('contact-name');
    const nameError = nameInput.nextElementSibling;
    if (!data.name || data.name.length < 2) {
        nameError.style.display = 'block';
        nameInput.classList.add('form-input-error');
        isValid = false;
    } else {
        nameError.style.display = 'none';
        nameInput.classList.remove('form-input-error');
    }

    // Validate email
    const emailInput = document.getElementById('contact-email');
    const emailError = emailInput.nextElementSibling;
    if (!isValidEmail(data.email)) {
        emailError.style.display = 'block';
        emailInput.classList.add('form-input-error');
        isValid = false;
    } else {
        emailError.style.display = 'none';
        emailInput.classList.remove('form-input-error');
    }

    // Validate message
    const messageInput = document.getElementById('contact-msg');
    const messageError = messageInput.nextElementSibling;
    if (!data.message || data.message.length < 10) {
        messageError.style.display = 'block';
        messageInput.classList.add('form-input-error');
        isValid = false;
    } else {
        messageError.style.display = 'none';
        messageInput.classList.remove('form-input-error');
    }

    return isValid;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function setLoadingState(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span> Saadan...';
    } else {
        button.disabled = false;
        const text = button.id.includes('membership') ? 'Saada liikmetaotlus' : 'Saada sõnum';
        button.innerHTML = `<span>${text}</span>`;
    }
}

function showMessage(messageDiv, message, type) {
    if (!messageDiv) return;

    messageDiv.className = 'form-message';
    messageDiv.classList.add(type === 'success' ? 'form-message-success' : 'form-message-error');
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            hideMessage(messageDiv);
        }, 5000);
    }
}

function hideMessage(messageDiv) {
    if (messageDiv) {
        messageDiv.style.display = 'none';
        messageDiv.className = 'form-message';
    }
}

// Add CSS for spinner
const style = document.createElement('style');
style.textContent = `
    .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid #ffffff;
        border-radius: 50%;
        border-top-color: transparent;
        animation: spin 0.8s linear infinite;
        margin-right: 8px;
        vertical-align: middle;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .form-input-error {
        border-color: #ef4444 !important;
    }

    .form-message {
        padding: 12px 16px;
        border-radius: 6px;
        margin-top: 16px;
        font-size: 14px;
    }

    .form-message-success {
        background-color: #d1fae5;
        border: 1px solid #10b981;
        color: #065f46;
    }

    .form-message-error {
        background-color: #fee2e2;
        border: 1px solid #ef4444;
        color: #991b1b;
    }
`;
document.head.appendChild(style);