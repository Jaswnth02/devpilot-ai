const mongoose = require('mongoose');

const projectJoinRequestSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoProject',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoUser',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoUser',
    default: null
  }
}, {
  timestamps: true,
  collection: 'project_join_requests'
});

// Ensure compound index for unique pending/active requests per user per project
projectJoinRequestSchema.index({ projectId: 1, userId: 1 });

module.exports = mongoose.models.ProjectJoinRequest || mongoose.model('ProjectJoinRequest', projectJoinRequestSchema, 'project_join_requests');
