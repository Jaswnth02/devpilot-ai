const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoUser',
    required: true
  },
  projectRole: {
    type: String,
    default: 'Developer'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    trim: true
  },
  tech_stack: {
    type: String,
    default: 'React, Node.js, Express, MongoDB'
  },
  technologyStack: {
    type: String
  },
  deadline: {
    type: String
  },
  targetDeadline: {
    type: String
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoUser',
    required: true
  },
  projectCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['Planning', 'Active', 'Completed', 'On Hold'],
    default: 'Planning'
  },
  members: [memberSchema],
  githubRepository: {
    githubRepositoryId: { type: String, default: null },
    owner: { type: String, default: null },
    name: { type: String, default: null },
    fullName: { type: String, default: null },
    htmlUrl: { type: String, default: null },
    defaultBranch: { type: String, default: 'main' },
    description: { type: String, default: '' },
    language: { type: String, default: '' },
    stars: { type: Number, default: 0 },
    forks: { type: Number, default: 0 },
    openIssuesCount: { type: Number, default: 0 },
    isPrivate: { type: Boolean, default: false },
    lastCommit: {
      sha: { type: String, default: null },
      message: { type: String, default: null },
      author: { type: String, default: null },
      date: { type: Date, default: null },
      url: { type: String, default: null }
    },
    connectedAt: { type: Date, default: null },
    lastSyncedAt: { type: Date, default: null }
  }
}, {
  timestamps: true,
  collection: 'projects'
});

// Pre-save hook to ensure technologyStack and targetDeadline aliases
projectSchema.pre('save', function (next) {
  if (this.tech_stack && !this.technologyStack) {
    this.technologyStack = this.tech_stack;
  } else if (this.technologyStack && !this.tech_stack) {
    this.tech_stack = this.technologyStack;
  }

  if (this.deadline && !this.targetDeadline) {
    this.targetDeadline = this.deadline;
  } else if (this.targetDeadline && !this.deadline) {
    this.deadline = this.targetDeadline;
  }

  next();
});

module.exports = mongoose.models.MongoProject || mongoose.model('MongoProject', projectSchema, 'projects');
