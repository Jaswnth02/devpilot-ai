const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'Task',
    enum: ['Task', 'Email', 'CustomNotification', 'GitHub', 'AI', 'Comment']
  },
  sentBy: {
    type: String,
    default: 'Project Owner'
  },
  senderId: {
    type: String,
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'notifications'
});

module.exports = mongoose.models.MongoNotification || mongoose.model('MongoNotification', notificationSchema, 'notifications');
