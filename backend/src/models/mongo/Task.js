const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  module: {
    type: String,
    required: true
  },
  required_skills: {
    type: [String],
    default: []
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['To Do', 'In Progress', 'In Review', 'Completed', 'Blocked'],
    default: 'To Do'
  },
  complexity: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  deadline: {
    type: String
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoProject',
    required: true
  },
  project_id: {
    type: String
  },
  assigned_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoUser',
    default: null
  },
  dependencies: {
    type: [String],
    default: []
  },
  comments: [{
    user_id: { type: String },
    userName: { type: String },
    userEmail: { type: String },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    User: {
      id: { type: String },
      name: { type: String },
      email: { type: String }
    }
  }],
  issues: [{
    reported_by_user_id: { type: String },
    reporterName: { type: String },
    description: { type: String, required: true },
    status: { type: String, default: 'Open' },
    ai_category: { type: String },
    ai_priority: { type: String },
    ai_causes: { type: String },
    ai_suggestions: { type: String },
    createdAt: { type: Date, default: Date.now },
    Reporter: {
      id: { type: String },
      name: { type: String }
    }
  }]
}, {
  timestamps: true,
  collection: 'tasks'
});

// Pre-save hook to ensure project_id alias matches projectId
taskSchema.pre('save', function (next) {
  if (this.projectId && !this.project_id) {
    this.project_id = this.projectId.toString();
  }
  next();
});

module.exports = mongoose.models.MongoTask || mongoose.model('MongoTask', taskSchema, 'tasks');
