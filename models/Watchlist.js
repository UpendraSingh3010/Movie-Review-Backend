const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true
  },
  dateAdded: {
    type: Date,
    default: Date.now
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  notes: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Compound index to ensure one watchlist entry per user per movie
watchlistSchema.index({ user: 1, movie: 1 }, { unique: true });

// Virtual for formatted date
watchlistSchema.virtual('formattedDate').get(function() {
  return this.dateAdded.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
});

// Ensure virtual fields are serialized
watchlistSchema.set('toJSON', { virtuals: true });
watchlistSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Watchlist', watchlistSchema);
