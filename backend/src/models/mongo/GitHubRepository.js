const mongoose = require('mongoose');

const gitHubRepositorySchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoProject',
    required: true,
    unique: true
  },
  owner: {
    type: String,
    required: true
  },
  repo_name: {
    type: String,
    required: true
  },
  webhook_secret: {
    type: String
  },
  linkedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'github_repositories'
});

module.exports = mongoose.models.MongoGitHubRepository || mongoose.model('MongoGitHubRepository', gitHubRepositorySchema, 'github_repositories');
