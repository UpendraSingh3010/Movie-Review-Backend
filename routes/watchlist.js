const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Watchlist = require('../models/Watchlist');
const Movie = require('../models/Movie');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/watchlist
// @desc    Get current user's watchlist
// @access  Private
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20'),
  query('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority level')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { page = 1, limit = 10, priority } = req.query;

    // Build filter object
    const filter = { user: req.user._id };
    if (priority) {
      filter.priority = priority;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const watchlistItems = await Watchlist.find(filter)
      .populate('movie', 'title posterUrl releaseYear averageRating genre director')
      .sort({ dateAdded: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    const total = await Watchlist.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      watchlist: watchlistItems,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get watchlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/watchlist
// @desc    Add movie to watchlist
// @access  Private
router.post('/', auth, [
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

    const { movieId, priority = 'medium', notes } = req.body;

    // Verify movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Check if movie is already in watchlist
    const existingItem = await Watchlist.findOne({
      user: req.user._id,
      movie: movieId
    });

    if (existingItem) {
      return res.status(400).json({ message: 'Movie is already in your watchlist' });
    }

    // Add to watchlist
    const watchlistItem = new Watchlist({
      user: req.user._id,
      movie: movieId,
      priority,
      notes
    });

    await watchlistItem.save();

    // Populate movie info for response
    await watchlistItem.populate('movie', 'title posterUrl releaseYear averageRating genre director');

    res.status(201).json({
      message: 'Movie added to watchlist successfully',
      watchlistItem
    });
  } catch (error) {
    console.error('Add to watchlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/watchlist/:itemId
// @desc    Update watchlist item
// @access  Private
router.put('/:itemId', auth, [
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

    const { itemId } = req.params;
    const { priority, notes } = req.body;

    const watchlistItem = await Watchlist.findById(itemId);

    if (!watchlistItem) {
      return res.status(404).json({ message: 'Watchlist item not found' });
    }

    // Check if user owns the watchlist item
    if (watchlistItem.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this watchlist item' });
    }

    // Update fields
    if (priority !== undefined) watchlistItem.priority = priority;
    if (notes !== undefined) watchlistItem.notes = notes;

    await watchlistItem.save();

    // Populate movie info for response
    await watchlistItem.populate('movie', 'title posterUrl releaseYear averageRating genre director');

    res.json({
      message: 'Watchlist item updated successfully',
      watchlistItem
    });
  } catch (error) {
    console.error('Update watchlist error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid watchlist item ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/watchlist/:itemId
// @desc    Remove movie from watchlist
// @access  Private
router.delete('/:itemId', auth, async (req, res) => {
  try {
    const { itemId } = req.params;

    const watchlistItem = await Watchlist.findById(itemId);

    if (!watchlistItem) {
      return res.status(404).json({ message: 'Watchlist item not found' });
    }

    // Check if user owns the watchlist item
    if (watchlistItem.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this watchlist item' });
    }

    await watchlistItem.remove();

    res.json({ message: 'Movie removed from watchlist successfully' });
  } catch (error) {
    console.error('Remove from watchlist error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid watchlist item ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/watchlist/movie/:movieId
// @desc    Remove movie from watchlist by movie ID
// @access  Private
router.delete('/movie/:movieId', auth, async (req, res) => {
  try {
    const { movieId } = req.params;

    const watchlistItem = await Watchlist.findOne({
      user: req.user._id,
      movie: movieId
    });

    if (!watchlistItem) {
      return res.status(404).json({ message: 'Movie not found in watchlist' });
    }

    await watchlistItem.remove();

    res.json({ message: 'Movie removed from watchlist successfully' });
  } catch (error) {
    console.error('Remove movie from watchlist error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid movie ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/watchlist/check/:movieId
// @desc    Check if movie is in user's watchlist
// @access  Private
router.get('/check/:movieId', auth, async (req, res) => {
  try {
    const { movieId } = req.params;

    const watchlistItem = await Watchlist.findOne({
      user: req.user._id,
      movie: movieId
    });

    res.json({
      inWatchlist: !!watchlistItem,
      watchlistItem: watchlistItem || null
    });
  } catch (error) {
    console.error('Check watchlist error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid movie ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/watchlist/stats
// @desc    Get watchlist statistics for current user
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    // Get total watchlist items
    const totalItems = await Watchlist.countDocuments({ user: req.user._id });

    // Get priority distribution
    const priorityStats = await Watchlist.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get genre distribution
    const genreStats = await Watchlist.aggregate([
      { $match: { user: req.user._id } },
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
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const stats = {
      totalItems,
      priorityDistribution: priorityStats,
      topGenres: genreStats
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get watchlist stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
