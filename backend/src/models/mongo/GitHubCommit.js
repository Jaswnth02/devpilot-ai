const mongoose = require('mongoose');

const gitHubCommitSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoProject',
    required: true
  },
  sha: {
    type: String,
    required: true,
    unique: true
  },
  message: {
    type: String,
    required: true
  },
  author_username: {
    type: String,
    default: 'unknown'
  },
  url: {
    type: String
  },
  committed_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'github_commits'
});

module.exports = mongoose.models.MongoGitHubCommit || mongoose.model('MongoGitHubCommit', gitHubCommitSchema, 'github_commits');
