// Email Service using Resend
const { Resend } = require('resend');
const config = require('../config');

let resend;

// Initialize Resend client
const initialize = () => {
  if (!config.RESEND_API_KEY) {
    console.warn('⚠️ Email service not configured - RESEND_API_KEY not set');
    return null;
  }

  resend = new Resend(config.RESEND_API_KEY);
  console.log('✅ Resend email service initialized');
  return resend;
};

// Test email connection
const testConnection = async () => {
  if (!resend) {
    initialize();
  }

  if (!resend) {
    throw new Error('Email service not configured');
  }

  // Resend doesn't have a verify method, so we'll just check if API key exists
  console.log('✅ Email service configured with Resend');
  return true;
};

// Send membership notification
const sendMembershipNotification = async (data) => {
  if (!resend) {
    console.warn('Email service not configured - skipping notification');
    return { sent: false, reason: 'Not configured' };
  }

  const { name, email, member_type, recaptcha_score, submitted_at } = data;
  const memberTypeLabel = member_type === 'toetajaliige' ? 'Toetajaliige' : 'Liige';

  const subject = 'Uus liikmetaotlus MTÜ Kaiu Kodukant';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #6b7280; }
        .value { color: #111827; margin-top: 5px; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        .score { display: inline-block; padding: 2px 8px; border-radius: 4px; }
        .score-good { background-color: #10b981; color: white; }
        .score-medium { background-color: #f59e0b; color: white; }
        .score-bad { background-color: #ef4444; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">Uus liikmetaotlus</h2>
        </div>
        <div class="content">
          <div class="field">
            <div class="label">Liikmetüüp:</div>
            <div class="value"><strong>${memberTypeLabel}</strong></div>
          </div>
          <div class="field">
            <div class="label">Nimi:</div>
            <div class="value">${escapeHtml(name)}</div>
          </div>
          <div class="field">
            <div class="label">E-post:</div>
            <div class="value"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>
          </div>
          <div class="field">
            <div class="label">Aeg:</div>
            <div class="value">${new Date(submitted_at).toLocaleString('et-EE')}</div>
          </div>
          <div class="field">
            <div class="label">reCAPTCHA skoor:</div>
            <div class="value">
              <span class="score ${recaptcha_score >= 0.7 ? 'score-good' : recaptcha_score >= 0.5 ? 'score-medium' : 'score-bad'}">
                ${recaptcha_score || 'N/A'}
              </span>
              ${recaptcha_score < 0.5 ? ' ⚠️ Madal skoor - võimalik späm' : ''}
            </div>
          </div>
          <div class="footer">
            <p>See kiri on saadetud automaatselt MTÜ Kaiu Kodukant veebilehe vormist.</p>
            <p><a href="${config.API_DOMAIN}/admin">Vaata kõiki taotlusi admin paneelist</a></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Uus liikmetaotlus MTÜ Kaiu Kodukant

Liikmetüüp: ${memberTypeLabel}
Nimi: ${name}
E-post: ${email}
Aeg: ${new Date(submitted_at).toLocaleString('et-EE')}
reCAPTCHA skoor: ${recaptcha_score || 'N/A'}

Vaata kõiki taotlusi: ${config.API_DOMAIN}/admin
  `.trim();

  try {
    const { data: result, error } = await resend.emails.send({
      from: `MTÜ Kaiu Kodukant <${config.RESEND_FROM_EMAIL}>`,
      to: [config.INFO_EMAIL],
      subject: subject,
      text: textContent,
      html: htmlContent
    });

    if (error) {
      console.error('Failed to send membership notification:', error);
      return { sent: false, error: error.message };
    }

    console.log('Membership notification sent:', result.id);
    return { sent: true, messageId: result.id };
  } catch (error) {
    console.error('Failed to send membership notification:', error);
    return { sent: false, error: error.message };
  }
};

// Send contact form notification
const sendContactNotification = async (data) => {
  if (!resend) {
    console.warn('Email service not configured - skipping notification');
    return { sent: false, reason: 'Not configured' };
  }

  const { name, email, subject, message, recaptcha_score, submitted_at } = data;

  const emailSubject = subject
    ? `Uus sõnum kodulehelt: ${subject}`
    : 'Uus sõnum kodulehelt';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #6b7280; }
        .value { color: #111827; margin-top: 5px; }
        .message-box { background-color: white; padding: 15px; border: 1px solid #e5e7eb; border-radius: 4px; margin-top: 10px; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        .score { display: inline-block; padding: 2px 8px; border-radius: 4px; }
        .score-good { background-color: #10b981; color: white; }
        .score-medium { background-color: #f59e0b; color: white; }
        .score-bad { background-color: #ef4444; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">Uus sõnum kodulehelt</h2>
        </div>
        <div class="content">
          <div class="field">
            <div class="label">Saatja:</div>
            <div class="value">${escapeHtml(name)}</div>
          </div>
          <div class="field">
            <div class="label">E-post:</div>
            <div class="value"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>
          </div>
          ${subject ? `
          <div class="field">
            <div class="label">Teema:</div>
            <div class="value">${escapeHtml(subject)}</div>
          </div>
          ` : ''}
          <div class="field">
            <div class="label">Sõnum:</div>
            <div class="message-box">${escapeHtml(message).replace(/\n/g, '<br>')}</div>
          </div>
          <div class="field">
            <div class="label">Aeg:</div>
            <div class="value">${new Date(submitted_at).toLocaleString('et-EE')}</div>
          </div>
          <div class="field">
            <div class="label">reCAPTCHA skoor:</div>
            <div class="value">
              <span class="score ${recaptcha_score >= 0.7 ? 'score-good' : recaptcha_score >= 0.5 ? 'score-medium' : 'score-bad'}">
                ${recaptcha_score || 'N/A'}
              </span>
              ${recaptcha_score < 0.5 ? ' ⚠️ Madal skoor - võimalik späm' : ''}
            </div>
          </div>
          <div class="footer">
            <p>See kiri on saadetud automaatselt MTÜ Kaiu Kodukant veebilehe kontaktivormist.</p>
            <p><a href="${config.API_DOMAIN}/admin">Vaata kõiki sõnumeid admin paneelist</a></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Uus sõnum kodulehelt

Saatja: ${name}
E-post: ${email}
${subject ? `Teema: ${subject}` : ''}
Aeg: ${new Date(submitted_at).toLocaleString('et-EE')}
reCAPTCHA skoor: ${recaptcha_score || 'N/A'}

Sõnum:
${message}

Vaata kõiki sõnumeid: ${config.API_DOMAIN}/admin
  `.trim();

  try {
    const { data: result, error } = await resend.emails.send({
      from: `MTÜ Kaiu Kodukant <${config.RESEND_FROM_EMAIL}>`,
      to: [config.INFO_EMAIL],
      replyTo: email, // Allow direct reply to sender
      subject: emailSubject,
      text: textContent,
      html: htmlContent
    });

    if (error) {
      console.error('Failed to send contact notification:', error);
      return { sent: false, error: error.message };
    }

    console.log('Contact notification sent:', result.id);
    return { sent: true, messageId: result.id };
  } catch (error) {
    console.error('Failed to send contact notification:', error);
    return { sent: false, error: error.message };
  }
};

// Send test email
const sendTestEmail = async () => {
  if (!resend) {
    initialize();
  }

  if (!resend) {
    throw new Error('Email service not configured');
  }

  try {
    const { data: result, error } = await resend.emails.send({
      from: `MTÜ Kaiu Kodukant Test <${config.RESEND_FROM_EMAIL}>`,
      to: [config.INFO_EMAIL],
      subject: 'Test Email - MTÜ Kaiu Kodukant API',
      text: 'This is a test email from the MTÜ Kaiu Kodukant API backend.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Test Email</h2>
          <p>This is a test email from the MTÜ Kaiu Kodukant API backend.</p>
          <p>Configuration verified successfully!</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Sent at: ${new Date().toLocaleString('et-EE')}
          </p>
        </div>
      `
    });

    if (error) {
      console.error('Failed to send test email:', error);
      throw error;
    }

    console.log('Test email sent:', result.id);
    return { sent: true, messageId: result.id };
  } catch (error) {
    console.error('Failed to send test email:', error);
    throw error;
  }
};

// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Initialize on module load
initialize();

module.exports = {
  testConnection,
  sendMembershipNotification,
  sendContactNotification,
  sendTestEmail
};
