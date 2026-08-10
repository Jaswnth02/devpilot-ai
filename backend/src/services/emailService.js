const nodemailer = require('nodemailer');
require('dotenv').config();

// Create Nodemailer Transporter using Gmail SMTP
const createTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD || process.env.MAIL_APP_PASSWORD;


  if (!user || !pass || user.includes('your-dedicated') || pass.includes('your-google')) {
    console.warn('⚠️ Gmail SMTP credentials not fully configured in .env (EMAIL_USER / EMAIL_APP_PASSWORD).');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass
    }
  });
};

/**
 * Send OTP verification email to user
 * @param {string} email 
 * @param {string} fullName 
 * @param {string} otp 
 */
const sendVerificationOtp = async (email, fullName, otp) => {
  const transporter = createTransporter();
  const fromAddress = process.env.EMAIL_FROM || `DevPilot AI <${process.env.EMAIL_USER || 'no-reply@devpilot.ai'}>`;

  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: 'Verify your DevPilot AI account',
    text: `Hi ${fullName},\n\nWelcome to DevPilot AI!\n\nYour email verification code is:\n\n${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not create this account, you can safely ignore this email.\n\nRegards,\nDevPilot AI Team`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; padding: 30px; background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 16px; color: #f8fafc;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #6366f1; margin: 0; font-size: 26px; font-weight: 800; tracking-tight: -0.025em;">🚀 DevPilot AI</h1>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Intelligent Software Workspace</p>
        </div>
        
        <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">Verify your email address</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">Hi <strong>${fullName}</strong>,</p>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">Welcome to <strong>DevPilot AI</strong>! Please use the 6-digit verification code below to complete your registration:</p>
          
          <div style="text-align: center; margin: 28px 0;">
            <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #818cf8; background-color: #1e1b4b; padding: 14px 28px; border-radius: 10px; border: 1px solid #4338ca;">
              ${otp}
            </span>
          </div>

          <p style="color: #f59e0b; font-size: 12px; text-align: center; margin-bottom: 0;">
            ⏱️ This verification code expires in <strong>5 minutes</strong>.
          </p>
        </div>

        <p style="color: #64748b; font-size: 12px; line-height: 1.5;">If you did not request this account creation, you can safely ignore this email.</p>
        
        <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
        
        <p style="color: #475569; font-size: 11px; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} DevPilot AI. All rights reserved.
        </p>
      </div>
    `
  };

  if (!transporter) {
    console.log(`[DEV MODE / MOCK EMAIL] OTP for ${email}: ${otp}`);
    return { success: true, mock: true };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email OTP sent successfully to ${email} (MessageID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send email via Nodemailer SMTP to ${email}:`, error.message);
    // Log OTP so dev workflow can continue if credentials aren't ready
    console.log(`[FALLBACK LOG] OTP for ${email}: ${otp}`);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendVerificationOtp
};
