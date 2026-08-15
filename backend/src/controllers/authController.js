const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const MongoUser = require('../models/mongo/User');
const MongoGitHubAccount = require('../models/mongo/GitHubAccount');
const { User: SqlUser } = require('../models');
const emailService = require('../services/emailService');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretdevpilotkey';

// Password Validation Helper: Min 8 chars, 1 upper, 1 lower, 1 number
const validatePasswordStrength = (password) => {
  if (!password || password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
};

// Helper: Sanitize GitHub username from URL or @handle
const sanitizeGithubUsername = (input) => {
  if (!input || typeof input !== 'string') return null;
  let trimmed = input.trim();
  if (trimmed.includes('github.com/')) {
    trimmed = trimmed.split('github.com/')[1].split('/')[0].split('?')[0];
  }
  trimmed = trimmed.replace(/^@/, '').trim();
  return trimmed || null;
};

// 1. REGISTER API
const register = async (req, res) => {
  try {
    const {
      fullName,
      name,
      email,
      password,
      confirmPassword,
      workspaceRole,
      role,
      experienceLevel,
      experience_level,
      skills,
      githubUsername,
      github_username
    } = req.body;

    const userFullName = (fullName || name || '').trim();
    const normalizedEmail = (email || '').toLowerCase().trim();
    const userRole = workspaceRole || role || 'Developer / Engineer';
    const userExp = experienceLevel || experience_level || 'Entry-Level';
    const parsedGithubUser = sanitizeGithubUsername(githubUsername || github_username);

    // Validate Required Fields
    if (!userFullName || userFullName.length < 2) {
      return res.status(400).json({ error: 'Full Name is required (minimum 2 characters).' });
    }

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    if (confirmPassword && confirmPassword !== password) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const skillsArray = Array.isArray(skills)
      ? skills
      : typeof skills === 'string'
      ? skills.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    if (skillsArray.length === 0) {
      return res.status(400).json({ error: 'Please select or enter at least one skill.' });
    }

    // Check if user already exists in MongoDB Atlas
    let existingUser = await MongoUser.findOne({ email: normalizedEmail });

    if (existingUser && existingUser.isEmailVerified) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    // Generate secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    if (existingUser && !existingUser.isEmailVerified) {
      // Overwrite unverified account details with new password & new OTP
      existingUser.fullName = userFullName;
      existingUser.name = userFullName;
      existingUser.password = password; // Will be hashed in pre-save hook
      existingUser.workspaceRole = userRole;
      existingUser.role = userRole;
      existingUser.experienceLevel = userExp;
      existingUser.experience_level = userExp;
      existingUser.skills = skillsArray;
      existingUser.githubUsername = parsedGithubUser;
      existingUser.emailOtp = otp;
      existingUser.emailOtpExpires = otpExpires;
      existingUser.otpResendCooldown = new Date(Date.now() + 60 * 1000); // 60s cooldown
      existingUser.otpAttempts = 0;

      await existingUser.save();
    } else {
      // Create new unverified user
      existingUser = await MongoUser.create({
        fullName: userFullName,
        name: userFullName,
        email: normalizedEmail,
        password, // Pre-save hook hashes password
        workspaceRole: userRole,
        role: userRole,
        experienceLevel: userExp,
        experience_level: userExp,
        skills: skillsArray,
        githubUsername: parsedGithubUser,
        isEmailVerified: false,
        emailOtp: otp,
        emailOtpExpires: otpExpires,
        otpResendCooldown: new Date(Date.now() + 60 * 1000),
        otpAttempts: 0
      });
    }

    // Send OTP via Gmail SMTP + Nodemailer (Never return OTP in response)
    await emailService.sendVerificationOtp(normalizedEmail, userFullName, otp);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! A 6-digit verification code has been sent to your email address.',
      email: normalizedEmail,
      requiresVerification: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Registration failed due to a server error.' });
  }
};

// 2. VERIFY EMAIL OTP API
const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const normalizedEmail = (email || '').toLowerCase().trim();
    const submittedOtp = (otp || '').trim();

    if (!normalizedEmail || !submittedOtp) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const user = await MongoUser.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ error: 'User account not found.' });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'Your email address is already verified. You can sign in.'
      });
    }

    if (!user.emailOtp || !user.emailOtpExpires || new Date() > user.emailOtpExpires) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    if (user.otpAttempts >= 5) {
      return res.status(400).json({ error: 'Too many failed verification attempts. Please request a new verification code.' });
    }

    if (user.emailOtp !== submittedOtp) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ error: 'Invalid verification code. Please check your inbox and try again.' });
    }

    // OTP matched successfully!
    user.isEmailVerified = true;
    user.emailOtp = null;
    user.emailOtpExpires = null;
    user.otpAttempts = 0;
    user.otpResendCooldown = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now log in to DevPilot AI.'
    });
  } catch (error) {
    console.error('Verify Email error:', error);
    return res.status(500).json({ error: 'Verification failed due to a server error.' });
  }
};

// 3. RESEND OTP API
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const normalizedEmail = (email || '').toLowerCase().trim();

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const user = await MongoUser.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ error: 'User account not found.' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: 'This email address is already verified.' });
    }

    // Enforce 60-second resend cooldown
    if (user.otpResendCooldown && new Date() < user.otpResendCooldown) {
      const secondsLeft = Math.ceil((user.otpResendCooldown.getTime() - Date.now()) / 1000);
      return res.status(429).json({
        error: `Please wait ${secondsLeft} second(s) before requesting a new verification code.`,
        cooldownRemaining: secondsLeft
      });
    }

    // Generate new 6-digit OTP & 5-minute expiry
    const newOtp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user.emailOtp = newOtp;
    user.emailOtpExpires = otpExpires;
    user.otpResendCooldown = new Date(Date.now() + 60 * 1000); // 60 seconds cooldown
    user.otpAttempts = 0;
    await user.save();

    // Send email via Nodemailer
    await emailService.sendVerificationOtp(normalizedEmail, user.fullName || user.name || 'User', newOtp);

    return res.status(200).json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email address.',
      cooldownSeconds: 60
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ error: 'Failed to resend verification code due to a server error.' });
  }
};

// 4. LOGIN API (WITH EMAIL VERIFICATION PROTECTION)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = (email || '').toLowerCase().trim();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Search in MongoDB Atlas first
    let user = await MongoUser.findOne({ email: normalizedEmail });
    let isMongoUser = true;

    // Fallback to SqlUser if not found in Mongo
    if (!user) {
      user = await SqlUser.findOne({ where: { email: normalizedEmail } });
      isMongoUser = false;
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Validate password
    let isValidPassword = false;
    if (isMongoUser) {
      isValidPassword = await user.comparePassword(password);
    } else {
      isValidPassword = await bcrypt.compare(password, user.password);
    }

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check if email is verified
    if (isMongoUser && user.isEmailVerified === false) {
      return res.status(403).json({
        error: 'Please verify your email before signing in.',
        requiresVerification: true,
        email: user.email
      });
    }

    const userId = isMongoUser ? user._id : user.id;

    // Generate JWT Token
    const token = jwt.sign({ id: userId, email: user.email, role: user.role || user.workspaceRole }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      token,
      user: {
        id: userId,
        fullName: user.fullName || user.name,
        name: user.name || user.fullName,
        email: user.email,
        role: user.role || user.workspaceRole,
        workspaceRole: user.workspaceRole || user.role,
        experienceLevel: user.experienceLevel || user.experience_level,
        experience_level: user.experience_level || user.experienceLevel,
        skills: user.skills || [],
        isEmailVerified: user.isEmailVerified !== undefined ? user.isEmailVerified : true,
        availability: user.availability !== undefined ? user.availability : true,
        current_workload: user.current_workload || 0
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed due to a server error.' });
  }
};

// 5. GET CURRENT USER PROFILE
const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    return res.status(200).json({
      id: req.user._id || req.user.id,
      fullName: req.user.fullName || req.user.name,
      name: req.user.name || req.user.fullName,
      email: req.user.email,
      role: req.user.role || req.user.workspaceRole,
      workspaceRole: req.user.workspaceRole || req.user.role,
      experienceLevel: req.user.experienceLevel || req.user.experience_level,
      experience_level: req.user.experience_level || req.user.experienceLevel,
      skills: req.user.skills || [],
      isEmailVerified: req.user.isEmailVerified !== undefined ? req.user.isEmailVerified : true,
      availability: req.user.availability !== undefined ? req.user.availability : true,
      current_workload: req.user.current_workload || 0
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Failed to retrieve user profile.' });
  }
};

module.exports = {
  register,
  verifyEmail,
  resendOtp,
  login,
  getMe
};
