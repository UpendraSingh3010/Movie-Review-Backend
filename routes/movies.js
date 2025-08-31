const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Movie = require('../models/Movie');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/movies/test
// @desc    Test endpoint to check if movies exist
// @access  Public
router.get('/test', async (req, res) => {
  try {
    const count = await Movie.countDocuments();
    const sampleMovie = await Movie.findOne().select('title posterUrl genre');
    
    res.json({
      message: 'Movies API is working',
      totalMovies: count,
      sampleMovie,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/movies
// @desc    Get all movies with pagination and filtering
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('genre').optional().isString().withMessage('Genre must be a string'),
  query('year').optional().isInt({ min: 1888, max: new Date().getFullYear() + 5 }).withMessage('Invalid year'),
  query('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),
  query('search').optional().isString().withMessage('Search query must be a string'),
  query('sort').optional().isIn(['title', 'releaseYear', 'averageRating', 'totalReviews']).withMessage('Invalid sort field'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      page = 1,
      limit = 12,
      genre,
      year,
      rating,
      search,
      sort = 'releaseYear',
      order = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (genre) {
      filter.genre = { $in: genre.split(',').map(g => g.trim()) };
    }
    
    if (year) {
      filter.releaseYear = parseInt(year);
    }
    
    if (rating) {
      filter.averageRating = { $gte: parseFloat(rating) };
    }
    
    if (search) {
      // Use regex search instead of text search to avoid language override issues
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { title: searchRegex },
        { director: searchRegex },
        { synopsis: searchRegex },
        { cast: searchRegex }
      ];
    }

    // Build sort object
    const sortObj = {};
    sortObj[sort] = order === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const movies = await Movie.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    const total = await Movie.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    // Add debugging
    console.log('Movies API called with filters:', filter);
    console.log('Found movies:', movies.length);
    console.log('Sample movie poster URL:', movies[0]?.posterUrl);

    res.json({
      movies,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalMovies: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get movies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/movies/featured
// @desc    Get featured movies
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const featuredMovies = await Movie.find({ featured: true })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(6)
      .select('-__v');

    res.json({ featuredMovies });
  } catch (error) {
    console.error('Get featured movies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/movies/trending
// @desc    Get trending movies
// @access  Public
router.get('/trending', async (req, res) => {
  try {
    const trendingMovies = await Movie.find({ trending: true })
      .sort({ totalReviews: -1, averageRating: -1 })
      .limit(6)
      .select('-__v');

    res.json({ trendingMovies });
  } catch (error) {
    console.error('Get trending movies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/movies/:id
// @desc    Get movie by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id).select('-__v');
    
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    res.json({ movie });
  } catch (error) {
    console.error('Get movie error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid movie ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/movies
// @desc    Add a new movie (admin only)
// @access  Private/Admin
router.post('/', adminAuth, [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must be less than 200 characters'),
  body('genre')
    .isArray({ min: 1 })
    .withMessage('At least one genre is required'),
  body('genre.*')
    .isIn([
      'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
      'Documentary', 'Drama', 'Family', 'Fantasy', 'Film-Noir', 'History',
      'Horror', 'Music', 'Musical', 'Mystery', 'Romance', 'Sci-Fi',
      'Sport', 'Thriller', 'War', 'Western'
    ])
    .withMessage('Invalid genre'),
  body('releaseYear')
    .isInt({ min: 1888, max: new Date().getFullYear() + 5 })
    .withMessage('Invalid release year'),
  body('director')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Director is required'),
  body('synopsis')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Synopsis must be between 10 and 2000 characters'),
  body('posterUrl')
    .isURL()
    .withMessage('Valid poster URL is required'),
  body('trailerUrl')
    .optional()
    .isURL()
    .withMessage('Trailer URL must be valid if provided'),
  body('runtime')
    .optional()
    .isInt({ min: 1, max: 600 })
    .withMessage('Runtime must be between 1 and 600 minutes')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    // Clean and prepare the data
    const movieData = {
      ...req.body,
      // Ensure arrays are properly formatted
      genre: Array.isArray(req.body.genre) ? req.body.genre.filter(g => g && g.trim()) : [req.body.genre].filter(g => g && g.trim()),
      cast: Array.isArray(req.body.cast) ? req.body.cast.filter(c => c && c.trim()) : req.body.cast ? [req.body.cast].filter(c => c && c.trim()) : [],
      // Ensure numeric fields are numbers
      releaseYear: Number(req.body.releaseYear),
      runtime: req.body.runtime ? Number(req.body.runtime) : undefined,
      imdbRating: req.body.imdbRating ? Number(req.body.imdbRating) : undefined,
      boxOffice: req.body.boxOffice ? Number(req.body.boxOffice) : undefined,
      // Ensure boolean fields are booleans
      featured: Boolean(req.body.featured),
      trending: Boolean(req.body.trending)
    };

    console.log('Creating movie with data:', JSON.stringify(movieData, null, 2));

    const movie = new Movie(movieData);
    
    // Validate the movie before saving
    const validationError = movie.validateSync();
    if (validationError) {
      console.error('Movie validation error:', validationError);
      return res.status(400).json({
        message: 'Movie validation failed',
        errors: Object.values(validationError.errors).map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    await movie.save();

    console.log('Movie created successfully:', movie._id);

    res.status(201).json({
      message: 'Movie added successfully',
      movie
    });
  } catch (error) {
    console.error('Add movie error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Movie with this title already exists' });
    }
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        message: 'Movie validation failed',
        errors: validationErrors
      });
    }
    
    res.status(500).json({ 
      message: 'Server error while creating movie',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/movies/:id
// @desc    Update movie (admin only)
// @access  Private/Admin
router.put('/:id', adminAuth, [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be less than 200 characters'),
  body('genre')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one genre is required'),
  body('genre.*')
    .optional()
    .isIn([
      'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
      'Documentary', 'Drama', 'Family', 'Fantasy', 'Film-Noir', 'History',
      'Horror', 'Music', 'Musical', 'Mystery', 'Romance', 'Sci-Fi',
      'Sport', 'Thriller', 'War', 'Western'
    ])
    .withMessage('Invalid genre'),
  body('releaseYear')
    .optional()
    .isInt({ min: 1888, max: new Date().getFullYear() + 5 })
    .withMessage('Invalid release year'),
  body('director')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Director cannot be empty'),
  body('synopsis')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Synopsis must be between 10 and 2000 characters'),
  body('posterUrl')
    .optional()
    .isURL()
    .withMessage('Valid poster URL is required'),
  body('trailerUrl')
    .optional()
    .isURL()
    .withMessage('Trailer URL must be valid if provided'),
  body('runtime')
    .optional()
    .isInt({ min: 1, max: 600 })
    .withMessage('Runtime must be between 1 and 600 minutes')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    res.json({
      message: 'Movie updated successfully',
      movie
    });
  } catch (error) {
    console.error('Update movie error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid movie ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/movies/:id
// @desc    Delete movie (admin only)
// @access  Private/Admin
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const movie = await Movie.findByIdAndDelete(req.params.id);
    
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    res.json({ message: 'Movie deleted successfully' });
  } catch (error) {
    console.error('Delete movie error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid movie ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
