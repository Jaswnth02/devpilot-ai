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

/**
 * Send task assignment notification email to assigned user's personal email
 */
const sendTaskAssignmentEmail = async ({
  userEmail,
  userName,
  taskTitle,
  taskDescription,
  projectName,
  assignerName,
  taskPriority,
  taskModule,
  taskDeadline
}) => {
  const transporter = createTransporter();
  const fromAddress = process.env.EMAIL_FROM || `DevPilot AI <${process.env.EMAIL_USER || 'no-reply@devpilot.ai'}>`;

  if (!userEmail) {
    console.warn('⚠️ No user email provided for task assignment notification.');
    return { success: false, error: 'No user email provided' };
  }

  const formattedDeadline = taskDeadline 
    ? new Date(taskDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No deadline';

  const mailOptions = {
    from: fromAddress,
    to: userEmail,
    subject: `📋 Task Assigned: "${taskTitle}" (${projectName || 'DevPilot AI'})`,
    text: `Hi ${userName || 'Team Member'},\n\n` +
      `You have been assigned a new task in project "${projectName || 'DevPilot AI'}":\n\n` +
      `📌 Task: ${taskTitle}\n` +
      `🏷️ Module: ${taskModule || 'General'}\n` +
      `⚡ Priority: ${taskPriority || 'Medium'}\n` +
      `📝 Description: ${taskDescription || 'No description provided.'}\n` +
      `📅 Deadline: ${formattedDeadline}\n` +
      (assignerName ? `👤 Assigned by: ${assignerName}\n\n` : '\n') +
      `Log in to DevPilot AI to view and manage your task details.\n\n` +
      `Best regards,\nDevPilot AI Team`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; color: #f8fafc;">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #1e293b; margin-bottom: 24px;">
          <h1 style="color: #6366f1; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">🚀 DevPilot AI</h1>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 4px; margin-bottom: 0;">Task Assignment Notification</p>
        </div>
        
        <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <div style="display: inline-block; padding: 4px 12px; background-color: #312e81; color: #a5b4fc; font-size: 11px; font-weight: 700; border-radius: 6px; text-transform: uppercase; margin-bottom: 12px;">
            ${taskModule || 'General Module'}
          </div>
          <h2 style="color: #ffffff; font-size: 20px; margin-top: 0; margin-bottom: 12px;">${taskTitle}</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
            Hi <strong>${userName || 'Team Member'}</strong>,<br/>
            ${assignerName ? `<strong style="color: #6366f1;">${assignerName}</strong> assigned you a task` : 'You have been assigned a task'} in project <strong style="color: #818cf8;">${projectName || 'DevPilot AI'}</strong>.
          </p>
          
          <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
            <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-top: 0; margin-bottom: 6px;">Description</p>
            <p style="color: #e2e8f0; font-size: 13px; margin: 0; line-height: 1.5;">${taskDescription || 'No detailed description provided.'}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #cbd5e1;">
            <tr>
              <td style="padding: 8px 0; color: #94a3b8;">Priority:</td>
              <td style="padding: 8px 0; font-weight: 700; color: ${taskPriority === 'High' ? '#f43f5e' : taskPriority === 'Medium' ? '#f59e0b' : '#94a3b8'};">${taskPriority || 'Medium'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8;">Deadline:</td>
              <td style="padding: 8px 0; font-weight: 600;">${formattedDeadline}</td>
            </tr>
            ${projectName ? `
            <tr>
              <td style="padding: 8px 0; color: #94a3b8;">Project Workspace:</td>
              <td style="padding: 8px 0; font-weight: 600; color: #a5b4fc;">${projectName}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
            Open DevPilot Workspace &rarr;
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
        
        <p style="color: #475569; font-size: 11px; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} DevPilot AI. All rights reserved.
        </p>
      </div>
    `
  };

  if (!transporter) {
    console.log(`[DEV MOCK EMAIL] Task assignment notification to ${userEmail}: "${taskTitle}"`);
    return { success: true, mock: true };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Task assignment notification email sent to ${userEmail} (MessageID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send task assignment email to ${userEmail}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send custom notification message email to user's personal email
 */
const sendCustomNotificationEmail = async ({
  userEmail,
  userName,
  title,
  message,
  senderName,
  projectName
}) => {
  const transporter = createTransporter();
  const fromAddress = process.env.EMAIL_FROM || `DevPilot AI <${process.env.EMAIL_USER || 'no-reply@devpilot.ai'}>`;

  if (!userEmail) {
    console.warn('⚠️ No user email provided for notification email.');
    return { success: false, error: 'No user email provided' };
  }

  const mailOptions = {
    from: fromAddress,
    to: userEmail,
    subject: `🔔 ${title || 'New Workspace Notification'} (${projectName || 'DevPilot AI'})`,
    text: `Hi ${userName || 'Team Member'},\n\n` +
      `${message}\n\n` +
      (senderName ? `Sent by: ${senderName}\n\n` : '\n') +
      `Best regards,\nDevPilot AI Team`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; color: #f8fafc;">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #1e293b; margin-bottom: 24px;">
          <h1 style="color: #6366f1; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">🚀 DevPilot AI</h1>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 4px; margin-bottom: 0;">Workspace Notification</p>
        </div>
        
        <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #ffffff; font-size: 20px; margin-top: 0; margin-bottom: 12px;">${title || 'Notification Message'}</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
            Hi <strong>${userName || 'Team Member'}</strong>,<br/>
            ${senderName ? `<strong style="color: #6366f1;">${senderName}</strong> sent you a message` : 'You have a new workspace notification'} in project <strong style="color: #818cf8;">${projectName || 'DevPilot AI'}</strong>.
          </p>
          
          <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 18px; margin-bottom: 16px;">
            <p style="color: #e2e8f0; font-size: 14px; margin: 0; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
            Open DevPilot Workspace &rarr;
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
        
        <p style="color: #475569; font-size: 11px; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} DevPilot AI. All rights reserved.
        </p>
      </div>
    `
  };

  if (!transporter) {
    console.log(`[DEV MOCK EMAIL] Custom notification to ${userEmail}: "${title}"`);
    return { success: true, mock: true };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Notification message sent to ${userEmail} (MessageID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send notification email to ${userEmail}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendVerificationOtp,
  sendTaskAssignmentEmail,
  sendCustomNotificationEmail
};
