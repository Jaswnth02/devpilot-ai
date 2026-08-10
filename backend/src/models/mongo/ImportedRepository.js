const mongoose = require('mongoose');

const importedRepositorySchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoProject',
    required: true
  },
  repositoryId: {
    type: String,
    required: true
  },
  repositoryName: {
    type: String,
    required: true
  },
  repositoryOwner: {
    type: String,
    required: true
  },
  repositoryUrl: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  language: {
    type: String,
    default: 'JavaScript'
  },
  stars: {
    type: Number,
    default: 0
  },
  forks: {
    type: Number,
    default: 0
  },
  updatedAtDate: {
    type: Date,
    default: Date.now
  },
  githubUsername: {
    type: String,
    default: ''
  },
  importedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoUser',
    required: true
  },
  importedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'importedRepositories'
});

module.exports = mongoose.models.ImportedRepository || mongoose.model('ImportedRepository', importedRepositorySchema, 'importedRepositories');
