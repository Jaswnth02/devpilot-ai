const mongoose = require('mongoose');

const gitHubConnectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoUser',
    required: true,
    unique: true,
    index: true
  },
  githubUserId: {
    type: String,
    required: true,
    index: true
  },
  githubId: {
    type: String
  },
  githubUsername: {
    type: String,
    required: true
  },
  githubAvatar: {
    type: String,
    default: ''
  },
  githubProfileUrl: {
    type: String,
    default: ''
  },
  githubEmail: {
    type: String,
    default: ''
  },
  accessToken: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'disconnected', 'revoked'],
    default: 'active'
  },
  connected: {
    type: Boolean,
    default: true
  },
  connectedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'githubConnections'
});

// Pre-save hook to ensure githubUserId and githubId are synchronized
gitHubConnectionSchema.pre('save', function (next) {
  if (this.githubUserId && !this.githubId) {
    this.githubId = this.githubUserId;
  } else if (this.githubId && !this.githubUserId) {
    this.githubUserId = this.githubId;
  }
  next();
});

module.exports = mongoose.models.GitHubConnection || mongoose.model('GitHubConnection', gitHubConnectionSchema, 'githubConnections');
