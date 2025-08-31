const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
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
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  reviewText: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 2000
  },
  helpful: {
    type: Number,
    default: 0
  },
  spoiler: {
    type: Boolean,
    default: false
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dislikes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Compound index to ensure one review per user per movie
reviewSchema.index({ user: 1, movie: 1 }, { unique: true });

// Pre-save middleware to update movie stats
reviewSchema.pre('save', async function(next) {
  try {
    const Movie = mongoose.model('Movie');
    const User = mongoose.model('User');
    
    // Update movie stats
    const movie = await Movie.findById(this.movie);
    if (movie) {
      // Calculate new average rating
      const allReviews = await this.constructor.find({ movie: this.movie });
      const totalRating = allReviews.reduce((sum, review) => sum + review.rating, 0);
      movie.averageRating = Math.round((totalRating / allReviews.length) * 10) / 10;
      movie.totalRatings = allReviews.length;
      movie.totalReviews = allReviews.length;
      await movie.save();
    }
    
    // Update user stats
    const user = await User.findById(this.user);
    if (user) {
      const userReviews = await this.constructor.find({ user: this.user });
      user.totalReviews = userReviews.length;
      const userTotalRating = userReviews.reduce((sum, review) => sum + review.rating, 0);
      user.averageRating = userReviews.length > 0 ? Math.round((userTotalRating / userReviews.length) * 10) / 10 : 0;
      await user.save();
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-remove middleware to update movie stats when review is deleted
reviewSchema.pre('remove', async function(next) {
  try {
    const Movie = mongoose.model('Movie');
    const User = mongoose.model('User');
    
    // Update movie stats
    const movie = await Movie.findById(this.movie);
    if (movie) {
      const remainingReviews = await this.constructor.find({ movie: this.movie });
      if (remainingReviews.length > 0) {
        const totalRating = remainingReviews.reduce((sum, review) => sum + review.rating, 0);
        movie.averageRating = Math.round((totalRating / remainingReviews.length) * 10) / 10;
        movie.totalRatings = remainingReviews.length;
        movie.totalReviews = remainingReviews.length;
      } else {
        movie.averageRating = 0;
        movie.totalRatings = 0;
        movie.totalReviews = 0;
      }
      await movie.save();
    }
    
    // Update user stats
    const user = await User.findById(this.user);
    if (user) {
      const userReviews = await this.constructor.find({ user: this.user });
      user.totalReviews = userReviews.length;
      if (userReviews.length > 0) {
        const userTotalRating = userReviews.reduce((sum, review) => sum + review.rating, 0);
        user.averageRating = Math.round((userTotalRating / userReviews.length) * 10) / 10;
      } else {
        user.averageRating = 0;
      }
      await user.save();
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Method to toggle like/dislike
reviewSchema.methods.toggleReaction = async function(userId, reactionType) {
  const likeIndex = this.likes.indexOf(userId);
  const dislikeIndex = this.dislikes.indexOf(userId);
  
  if (reactionType === 'like') {
    if (likeIndex > -1) {
      this.likes.splice(likeIndex, 1);
    } else {
      this.likes.push(userId);
      if (dislikeIndex > -1) {
        this.dislikes.splice(dislikeIndex, 1);
      }
    }
  } else if (reactionType === 'dislike') {
    if (dislikeIndex > -1) {
      this.dislikes.splice(dislikeIndex, 1);
    } else {
      this.dislikes.push(userId);
      if (likeIndex > -1) {
        this.likes.splice(likeIndex, 1);
      }
    }
  }
  
  return this.save();
};

module.exports = mongoose.model('Review', reviewSchema);
