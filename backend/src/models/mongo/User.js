const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email address is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  workspaceRole: {
    type: String,
    default: 'Developer / Engineer'
  },
  experienceLevel: {
    type: String,
    default: 'Entry-Level'
  },
  skills: {
    type: [String],
    default: []
  },
  githubUsername: {
    type: String,
    trim: true,
    default: null
  },
  github: {
    githubUserId: { type: String, default: null },
    username: { type: String, default: null },
    connected: { type: Boolean, default: false },
    accessToken: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    profileUrl: { type: String, default: null },
    email: { type: String, default: null },
    connectedAt: { type: Date, default: null },
    lastSyncedAt: { type: Date, default: null }
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailOtp: {
    type: String,
    default: null
  },
  emailOtpExpires: {
    type: Date,
    default: null
  },
  otpResendCooldown: {
    type: Date,
    default: null
  },
  otpAttempts: {
    type: Number,
    default: 0
  },
  // Backward compatibility fields for legacy UI calls if needed
  name: {
    type: String
  },
  role: {
    type: String,
    default: 'Developer'
  },
  experience_level: {
    type: String,
    default: 'Mid'
  },
  availability: {
    type: Boolean,
    default: true
  },
  current_workload: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  collection: 'login_ids'
});

// Pre-save hook to keep name/fullName synchronized and hash password
userSchema.pre('save', async function (next) {
  if (this.fullName && !this.name) {
    this.name = this.fullName;
  } else if (this.name && !this.fullName) {
    this.fullName = this.name;
  }

  if (this.workspaceRole && !this.role) {
    this.role = this.workspaceRole;
  }

  if (this.experienceLevel && !this.experience_level) {
    this.experience_level = this.experienceLevel;
  }

  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password helper
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.MongoUser || mongoose.model('MongoUser', userSchema, 'login_ids');
