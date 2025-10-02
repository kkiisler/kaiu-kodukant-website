// Email Service using Nodemailer
const nodemailer = require('nodemailer');
const config = require('../config');

let transporter;

// Initialize email transporter
const initialize = () => {
  if (!config.SMTP_HOST || !config.SMTP_USER) {
    console.warn('⚠️ Email service not configured - notifications will not be sent');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false // Allow self-signed certificates
    }
  });

  return transporter;
};

// Test email connection
const testConnection = async () => {
  if (!transporter) {
    initialize();
  }

  if (!transporter) {
    throw new Error('Email service not configured');
  }

  try {
    await transporter.verify();
    console.log('✅ Email server connection verified');
    return true;
  } catch (error) {
    console.error('❌ Email server connection failed:', error);
    throw error;
  }
};

// Send membership notification
const sendMembershipNotification = async (data) => {
  if (!transporter) {
    console.warn('Email service not configured - skipping notification');
    return { sent: false, reason: 'Not configured' };
  }

  const { name, email, recaptcha_score, submitted_at } = data;

  const subject = 'Uus liikmestaotus MTÜ Kaiu Kodukant';

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
          <h2 style="margin: 0;">Uus liikmestaotus</h2>
        </div>
        <div class="content">
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
Uus liikmestaotus MTÜ Kaiu Kodukant

Nimi: ${name}
E-post: ${email}
Aeg: ${new Date(submitted_at).toLocaleString('et-EE')}
reCAPTCHA skoor: ${recaptcha_score || 'N/A'}

Vaata kõiki taotlusi: ${config.API_DOMAIN}/admin
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: `"MTÜ Kaiu Kodukant" <${config.SMTP_FROM}>`,
      to: config.ADMIN_EMAIL,
      subject: subject,
      text: textContent,
      html: htmlContent
    });

    console.log('Membership notification sent:', info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send membership notification:', error);
    return { sent: false, error: error.message };
  }
};

// Send contact form notification
const sendContactNotification = async (data) => {
  if (!transporter) {
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
    const info = await transporter.sendMail({
      from: `"MTÜ Kaiu Kodukant" <${config.SMTP_FROM}>`,
      to: config.ADMIN_EMAIL,
      replyTo: email, // Allow direct reply to sender
      subject: emailSubject,
      text: textContent,
      html: htmlContent
    });

    console.log('Contact notification sent:', info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send contact notification:', error);
    return { sent: false, error: error.message };
  }
};

// Send test email
const sendTestEmail = async () => {
  if (!transporter) {
    initialize();
  }

  if (!transporter) {
    throw new Error('Email service not configured');
  }

  try {
    const info = await transporter.sendMail({
      from: `"MTÜ Kaiu Kodukant Test" <${config.SMTP_FROM}>`,
      to: config.ADMIN_EMAIL,
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

    console.log('Test email sent:', info.messageId);
    return { sent: true, messageId: info.messageId };
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