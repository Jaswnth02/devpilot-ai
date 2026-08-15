const mongoose = require('mongoose');

const oAuthStateSchema = new mongoose.Schema({
  state: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoUser',
    required: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MongoProject',
    default: null
  },
  returnUrl: {
    type: String,
    default: null
  },
  used: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // MongoDB TTL index automatically removes expired states
  }
}, {
  timestamps: true,
  collection: 'oauth_states'
});

module.exports = mongoose.models.OAuthState || mongoose.model('OAuthState', oAuthStateSchema, 'oauth_states');
