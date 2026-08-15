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

const commitSchema = new mongoose.Schema({
  sha: { type: String, default: null },
  message: { type: String, default: null },
  author: { type: String, default: null },
  date: { type: Date, default: null },
  url: { type: String, default: null },
  branch: { type: String, default: 'main' }
}, { _id: false });

const pullRequestSchema = new mongoose.Schema({
  number: { type: Number },
  title: { type: String },
  state: { type: String, default: 'open' },
  author: { type: String },
  createdAt: { type: Date },
  url: { type: String },
  branch: { type: String }
}, { _id: false });

const branchSchema = new mongoose.Schema({
  name: { type: String },
  isDefault: { type: Boolean, default: false }
}, { _id: false });

const contributorSchema = new mongoose.Schema({
  username: { type: String },
  avatarUrl: { type: String },
  contributions: { type: Number, default: 0 }
}, { _id: false });

const githubIntegrationSchema = new mongoose.Schema({
  connected: { type: Boolean, default: false },
  repositoryId: { type: String, default: null },
  repositoryName: { type: String, default: null },
  repositoryOwner: { type: String, default: null },
  repositoryUrl: { type: String, default: null },
  defaultBranch: { type: String, default: 'main' },
  visibility: { type: String, default: 'public' },
  description: { type: String, default: '' },
  language: { type: String, default: '' },
  stars: { type: Number, default: 0 },
  forks: { type: Number, default: 0 },
  openIssuesCount: { type: Number, default: 0 },
  webhookId: { type: String, default: null },
  connectedAt: { type: Date, default: null },
  lastSyncedAt: { type: Date, default: null },
  latestCommit: commitSchema,
  recentCommits: [commitSchema],
  pullRequests: [pullRequestSchema],
  branches: [branchSchema],
  contributors: [contributorSchema]
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
  githubIntegration: {
    type: githubIntegrationSchema,
    default: () => ({ connected: false })
  },
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
    lastCommit: commitSchema,
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
