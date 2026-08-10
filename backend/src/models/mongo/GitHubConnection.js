const mongoose = require('mongoose');

const gitHubConnectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoUser',
    required: true,
    unique: true
  },
  githubId: {
    type: String,
    required: true
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
  connected: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'githubConnections'
});

module.exports = mongoose.models.GitHubConnection || mongoose.model('GitHubConnection', gitHubConnectionSchema, 'githubConnections');
