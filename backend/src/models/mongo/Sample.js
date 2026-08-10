const mongoose = require('mongoose');

const sampleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  },
  metadata: {
    createdByUserEmail: String,
    tags: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook example
sampleSchema.pre('save', function(next) {
  console.log(`Saving sample document: ${this.title}`);
  next();
});

const Sample = mongoose.model('Sample', sampleSchema);

module.exports = Sample;
