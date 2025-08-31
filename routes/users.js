const express = require('express');
const { body, validationResult, query } = require('express-validator');
const User = require('../models/User');
const Review = require('../models/Review');
const { auth } = require('../middleware/auth');
const Watchlist = require('../models/Watchlist'); // Added Watchlist model
const Movie = require('../models/Movie'); // Added Movie model

const router = express.Router();

// @route   GET /api/users/search/:query
// @desc    Search users by username
// @access  Public
router.get('/search/:query', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { query: searchQuery } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find({
      username: { $regex: searchQuery, $options: 'i' }
    })
      .select('username profilePicture totalReviews averageRating joinDate')
      .sort({ totalReviews: -1, averageRating: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments({
      username: { $regex: searchQuery, $options: 'i' }
    });
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalUsers: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:userId/watchlist
// @desc    Get user's watchlist by user ID
// @access  Public (for viewing other users' watchlists)
router.get('/:userId/watchlist', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20'),
  query('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority level')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { page = 1, limit = 10, priority } = req.query;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Build filter object
    const filter = { user: userId };
    if (priority) {
      filter.priority = priority;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const watchlistItems = await Watchlist.find(filter)
      .populate('movie', 'title posterUrl releaseYear averageRating genre director runtime synopsis')
      .sort({ dateAdded: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    const total = await Watchlist.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      watchlist: watchlistItems,
      user: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get user watchlist error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:userId/watchlist
// @desc    Add movie to user's watchlist
// @access  Private (only own watchlist)
router.post('/:userId/watchlist', auth, [
  body('movieId')
    .isMongoId()
    .withMessage('Valid movie ID is required'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { movieId, priority = 'medium', notes } = req.body;

    // Check if user is adding to their own watchlist
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to add to this user\'s watchlist' });
    }

    // Verify movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Check if movie is already in watchlist
    const existingItem = await Watchlist.findOne({
      user: userId,
      movie: movieId
    });

    if (existingItem) {
      return res.status(400).json({ message: 'Movie is already in your watchlist' });
    }

    // Add to watchlist
    const watchlistItem = new Watchlist({
      user: userId,
      movie: movieId,
      priority,
      notes
    });

    await watchlistItem.save();

    // Populate movie info for response
    await watchlistItem.populate('movie', 'title posterUrl releaseYear averageRating genre director runtime synopsis');

    res.status(201).json({
      message: 'Movie added to watchlist successfully',
      watchlistItem
    });
  } catch (error) {
    console.error('Add to user watchlist error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID or movie ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/:userId/watchlist/:movieId
// @desc    Remove movie from user's watchlist
// @access  Private (only own watchlist)
router.delete('/:userId/watchlist/:movieId', auth, async (req, res) => {
  try {
    const { userId, movieId } = req.params;

    // Check if user is removing from their own watchlist
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to remove from this user\'s watchlist' });
    }

    // Verify movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Find and remove watchlist item
    const watchlistItem = await Watchlist.findOneAndDelete({
      user: userId,
      movie: movieId
    });

    if (!watchlistItem) {
      return res.status(404).json({ message: 'Movie not found in watchlist' });
    }

    res.json({ 
      message: 'Movie removed from watchlist successfully',
      removedMovie: {
        _id: movie._id,
        title: movie.title,
        posterUrl: movie.posterUrl
      }
    });
  } catch (error) {
    console.error('Remove from user watchlist error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID or movie ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:userId/reviews
// @desc    Get reviews by a specific user
// @access  Public
router.get('/:userId/reviews', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const reviews = await Review.find({ user: userId })
      .populate('movie', 'title posterUrl releaseYear averageRating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    const total = await Review.countDocuments({ user: userId });
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalReviews: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:userId/stats
// @desc    Get user statistics
// @access  Public
router.get('/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get review statistics
    const reviewStats = await Review.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          totalLikes: { $sum: { $size: '$likes' } },
          totalDislikes: { $sum: { $size: '$likes' } }
        }
      }
    ]);

    // Get genre preferences
    const genreStats = await Review.aggregate([
      { $match: { user: user._id } },
      {
        $lookup: {
          from: 'movies',
          localField: 'movie',
          foreignField: '_id',
          as: 'movieData'
        }
      },
      { $unwind: '$movieData' },
      { $unwind: '$movieData.genre' },
      {
        $group: {
          _id: '$movieData.genre',
          count: { $sum: 1 },
          averageRating: { $avg: '$rating' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const stats = {
      totalReviews: reviewStats[0]?.totalReviews || 0,
      averageRating: Math.round((reviewStats[0]?.averageRating || 0) * 10) / 10,
      totalLikes: reviewStats[0]?.totalLikes || 0,
      totalDislikes: reviewStats[0]?.totalDislikes || 0,
      topGenres: genreStats,
      joinDate: user.joinDate,
      totalReviews: user.totalReviews,
      averageRating: user.averageRating
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get user stats error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:userId
// @desc    Update user profile (only own profile)
// @access  Private
router.put('/:userId', auth, [
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  body('profilePicture')
    .optional()
    .isURL()
    .withMessage('Profile picture must be a valid URL')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;

    // Check if user is updating their own profile
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this profile' });
    }

    const { username, bio, profilePicture } = req.body;
    const updateFields = {};

    if (username && username !== req.user.username) {
      // Check if username is already taken
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      updateFields.username = username;
    }

    if (bio !== undefined) updateFields.bio = bio;
    if (profilePicture !== undefined) updateFields.profilePicture = profilePicture;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password -__v');

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:userId
// @desc    Get user profile by ID
// @access  Public
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password -__v');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:userId/watchlist/check/:movieId
// @desc    Check if movie is in user's watchlist
// @access  Public
router.get('/:userId/watchlist/check/:movieId', async (req, res) => {
  try {
    const { userId, movieId } = req.params;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Check if movie is in watchlist
    const watchlistItem = await Watchlist.findOne({
      user: userId,
      movie: movieId
    });

    res.json({
      inWatchlist: !!watchlistItem,
      watchlistItem: watchlistItem || null
    });
  } catch (error) {
    console.error('Check user watchlist error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID or movie ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
