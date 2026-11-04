const nodemailer = require('nodemailer');
const { buildBookingEmail } = require('../utils/bookingReceipt');
const { buildGameReminderMessage } = require('../utils/gameReminderMessage');
require('dotenv').config();

const isDevMode = process.env.EMAIL_DEV_MODE === 'true';

let transporter;

if (isDevMode) {
  transporter = {
    sendMail: async (mailOptions) => {
      console.log('\n=================== [DEV MODE EMAIL] ===================');
      console.log(`To: ${mailOptions.to}`);
      console.log(`From: ${mailOptions.from || process.env.EMAIL_FROM}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log('--- Text Content ---');
      console.log(mailOptions.text || '(No plain text)');
      console.log('--- HTML Preview ---');
      console.log(mailOptions.html ? mailOptions.html.substring(0, 300) + '...' : '(No HTML)');
      console.log('========================================================\n');
      return { messageId: `dev-${Date.now()}` };
    }
  };
} else {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    dnsTimeout: 5000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

/**
 * Base email sender function
 */
const sendEmail = async ({ to, subject, html, text, attachments = [] }) => {
  try {
    const from = process.env.EMAIL_FROM || 'PickleBook <noreply@picklebook.com>';
    const mailOptions = {
      from,
      to,
      subject,
      text,
      html,
      attachments,
      disableFileAccess: true,
      disableUrlAccess: true
    };

    const info = await transporter.sendMail(mailOptions);
    if (!isDevMode && (!Array.isArray(info.accepted) || info.accepted.length === 0 || info.rejected?.length)) {
      return { success: false, status: 'failed', error: 'The SMTP server did not accept the email.' };
    }
    return { success: true, status: isDevMode ? 'simulated' : 'sent', messageId: info.messageId };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, status: 'failed', error: error.message };
  }
};

/**
 * Send email verification link
 */
const sendVerificationEmail = async (to, name, rawToken) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationUrl = `${frontendUrl}/verify-email?token=${rawToken}&email=${encodeURIComponent(to)}`;

  const subject = 'Verify your PickleBook account';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #16a34a;">Welcome to PickleBook, ${name}!</h2>
      <p>Thank you for registering. Please click the button below to verify your email address. This link is valid for 24 hours.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
      </div>
      <p style="color: #666; font-size: 13px;">If the button above doesn't work, copy and paste this link into your browser:</p>
      <p style="color: #666; font-size: 13px; word-break: break-all;"><a href="${verificationUrl}">${verificationUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px;">If you didn't create an account with PickleBook, you can safely ignore this email.</p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: `Welcome to PickleBook, ${name}!\n\nPlease verify your email by visiting: ${verificationUrl}`
  });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (to, name, rawToken) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(to)}`;

  const subject = 'Reset your PickleBook password';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2563eb;">PickleBook Password Reset</h2>
      <p>Hello ${name},</p>
      <p>We received a request to reset your PickleBook account password. Click the button below to proceed. This link will expire in 1 hour.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #666; font-size: 13px;">If you didn't request a password reset, please ignore this email or contact support if you suspect unauthorized access.</p>
      <p style="color: #666; font-size: 13px; word-break: break-all;"><a href="${resetUrl}">${resetUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px;">PickleBook Security Team</p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: `Hello ${name},\n\nReset your password at: ${resetUrl}\n\nThis link expires in 1 hour.`
  });
};

/**
 * Send reservation confirmation email
 */
const sendReservationConfirmationEmail = async (to, name, reservation) => {
  const message = buildBookingEmail(name, reservation, process.env.FRONTEND_URL || 'http://localhost:5173');
  const result = await sendEmail({ to, ...message });
  return { ...result, receipt_attached: result.success === true };
};

/** Send a game reminder only to the customer attached to the reservation. */
const sendGameReminderEmail = async (reservation, options = {}) => {
  const recipient = reservation.user_email;
  if (typeof recipient !== 'string' || !/^[^\s\u0000-\u001f\u007f-\u009f<>(),;:@"\\]+@[^\s\u0000-\u001f\u007f-\u009f<>(),;:@"\\]+$/.test(recipient)) {
    return { success: false, status: 'failed', error: 'A valid customer email address is required for the game reminder.' };
  }
  const { subject, html, text } = buildGameReminderMessage(reservation, options);
  return sendEmail({ to: recipient, subject, html, text });
};

module.exports = {
  transporter,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendReservationConfirmationEmail,
  sendGameReminderEmail
};
