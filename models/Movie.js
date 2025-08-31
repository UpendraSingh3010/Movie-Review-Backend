const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  genre: {
    type: [String],
    required: [true, 'At least one genre is required'],
    validate: {
      validator: function(genres) {
        if (!Array.isArray(genres) || genres.length === 0) {
          return false;
        }
        const validGenres = [
          'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
          'Documentary', 'Drama', 'Family', 'Fantasy', 'Film-Noir', 'History',
          'Horror', 'Music', 'Musical', 'Mystery', 'Romance', 'Sci-Fi',
          'Sport', 'Thriller', 'War', 'Western'
        ];
        return genres.every(genre => validGenres.includes(genre));
      },
      message: 'Genre must be an array of valid genres from the allowed list'
    }
  },
  releaseYear: {
    type: Number,
    required: [true, 'Release year is required'],
    min: [1888, 'Release year cannot be earlier than 1888'],
    max: [new Date().getFullYear() + 5, 'Release year cannot be more than 5 years in the future']
  },
  director: {
    type: String,
    required: [true, 'Director is required'],
    trim: true,
    minlength: [1, 'Director name cannot be empty']
  },
  cast: {
    type: [String],
    default: [],
    validate: {
      validator: function(cast) {
        if (!Array.isArray(cast)) return false;
        return cast.every(member => typeof member === 'string' && member.trim().length > 0);
      },
      message: 'Cast must be an array of non-empty strings'
    }
  },
  synopsis: {
    type: String,
    required: [true, 'Synopsis is required'],
    trim: true,
    minlength: [10, 'Synopsis must be at least 10 characters long'],
    maxlength: [2000, 'Synopsis cannot exceed 2000 characters']
  },
  posterUrl: {
    type: String,
    required: [true, 'Poster URL is required'],
    validate: {
      validator: function(v) {
        if (!v) return false;
        try {
          const url = new URL(v);
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          return false;
        }
      },
      message: 'Poster URL must be a valid HTTP/HTTPS URL'
    }
  },
  trailerUrl: {
    type: String,
    required: false,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        try {
          const url = new URL(v);
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          return false;
        }
      },
      message: 'Trailer URL must be a valid HTTP/HTTPS URL if provided'
    }
  },
  runtime: {
    type: Number,
    required: false,
    min: [1, 'Runtime must be at least 1 minute'],
    max: [600, 'Runtime cannot exceed 600 minutes']
  },
  language: {
    type: String,
    default: 'English',
    trim: true,
    enum: {
      values: ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Bengali', 'Turkish', 'Dutch', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Polish', 'Czech', 'Hungarian', 'Romanian', 'Bulgarian', 'Greek', 'Hebrew', 'Thai', 'Vietnamese', 'Indonesian', 'Malay', 'Filipino'],
      message: 'Language must be one of the supported languages'
    }
  },
  country: {
    type: String,
    default: 'United States',
    trim: true
  },
  averageRating: {
    type: Number,
    default: 0,
    min: [0, 'Average rating cannot be negative'],
    max: [5, 'Average rating cannot exceed 5']
  },
  totalRatings: {
    type: Number,
    default: 0,
    min: [0, 'Total ratings cannot be negative']
  },
  totalReviews: {
    type: Number,
    default: 0,
    min: [0, 'Total reviews cannot be negative']
  },
  featured: {
    type: Boolean,
    default: false
  },
  trending: {
    type: Boolean,
    default: false
  },
  imdbRating: {
    type: Number,
    required: false,
    min: [0, 'IMDb rating cannot be negative'],
    max: [10, 'IMDb rating cannot exceed 10']
  },
  boxOffice: {
    type: Number,
    required: false,
    min: [0, 'Box office cannot be negative']
  }
}, {
  timestamps: true,
  strict: true
});

// Pre-save middleware to clean up data
movieSchema.pre('save', function(next) {
  // Clean up genre array - remove duplicates and empty values
  if (this.genre && Array.isArray(this.genre)) {
    this.genre = [...new Set(this.genre.filter(g => g && g.trim()))];
  }
  
  // Clean up cast array - remove empty values
  if (this.cast && Array.isArray(this.cast)) {
    this.cast = this.cast.filter(member => member && member.trim());
  }
  
  // Ensure numeric fields are numbers
  if (this.releaseYear) this.releaseYear = Number(this.releaseYear);
  if (this.runtime) this.runtime = Number(this.runtime);
  if (this.imdbRating) this.imdbRating = Number(this.imdbRating);
  if (this.boxOffice) this.boxOffice = Number(this.boxOffice);
  if (this.averageRating) this.averageRating = Number(this.averageRating);
  if (this.totalRatings) this.totalRatings = Number(this.totalRatings);
  if (this.totalReviews) this.totalReviews = Number(this.totalReviews);
  
  // Ensure boolean fields are booleans
  if (typeof this.featured !== 'boolean') this.featured = Boolean(this.featured);
  if (typeof this.trending !== 'boolean') this.trending = Boolean(this.trending);
  
  next();
});

// Index for search functionality - removed text index to prevent language override errors
// movieSchema.index({ 
//   title: 'text', 
//   director: 'text', 
//   cast: 'text', 
//   synopsis: 'text' 
// });

// Instead, create simple indexes for better performance
movieSchema.index({ title: 1 });
movieSchema.index({ director: 1 });
movieSchema.index({ genre: 1 });
movieSchema.index({ releaseYear: -1 });
movieSchema.index({ averageRating: -1 });

// Virtual for formatted runtime
movieSchema.virtual('formattedRuntime').get(function() {
  if (!this.runtime) return null;
  const hours = Math.floor(this.runtime / 60);
  const minutes = this.runtime % 60;
  return `${hours}h ${minutes}m`;
});

// Method to update average rating
movieSchema.methods.updateAverageRating = function() {
  if (this.totalRatings === 0) {
    this.averageRating = 0;
  } else {
    // This will be calculated when reviews are added/updated
    this.averageRating = Math.round((this.averageRating * 10)) / 10;
  }
};

// Ensure virtual fields are serialized
movieSchema.set('toJSON', { virtuals: true });
movieSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Movie', movieSchema);
