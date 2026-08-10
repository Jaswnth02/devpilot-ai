const mongoose = require('mongoose');

const gitHubAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoUser',
    required: true,
    unique: true
  },
  github_username: {
    type: String,
    required: true
  },
  access_token: {
    type: String,
    required: true
  },
  connectedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'github_accounts'
});

module.exports = mongoose.models.MongoGitHubAccount || mongoose.model('MongoGitHubAccount', gitHubAccountSchema, 'github_accounts');
