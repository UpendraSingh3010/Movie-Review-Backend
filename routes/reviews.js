const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Review = require('../models/Review');
const Movie = require('../models/Movie');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/reviews/movie/:movieId
// @desc    Get reviews for a specific movie
// @access  Public
router.get('/movie/:movieId', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20'),
  query('sort').optional().isIn(['rating', 'createdAt', 'helpful']).withMessage('Invalid sort field'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { movieId } = req.params;
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;

    // Verify movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Build sort object
    const sortObj = {};
    sortObj[sort] = order === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const reviews = await Review.find({ movie: movieId })
      .populate('user', 'username profilePicture totalReviews averageRating')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    const total = await Review.countDocuments({ movie: movieId });
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
    console.error('Get movie reviews error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid movie ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reviews/user/:userId
// @desc    Get reviews by a specific user
// @access  Public
router.get('/user/:userId', [
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

// @route   POST /api/reviews
// @desc    Submit a new review
// @access  Private
router.post('/', auth, [
  body('movieId')
    .isMongoId()
    .withMessage('Valid movie ID is required'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('reviewText')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Review text must be between 10 and 2000 characters'),
  body('spoiler')
    .optional()
    .isBoolean()
    .withMessage('Spoiler must be a boolean value')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { movieId, rating, reviewText, spoiler = false } = req.body;

    // Verify movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Check if user already reviewed this movie
    const existingReview = await Review.findOne({
      user: req.user._id,
      movie: movieId
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this movie' });
    }

    // Create new review
    const review = new Review({
      user: req.user._id,
      movie: movieId,
      rating,
      reviewText,
      spoiler
    });

    await review.save();

    // Populate user info for response
    await review.populate('user', 'username profilePicture');

    res.status(201).json({
      message: 'Review submitted successfully',
      review
    });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/reviews/:reviewId
// @desc    Update a review
// @access  Private
router.put('/:reviewId', auth, [
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('reviewText')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Review text must be between 10 and 2000 characters'),
  body('spoiler')
    .optional()
    .isBoolean()
    .withMessage('Spoiler must be a boolean value')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { reviewId } = req.params;
    const updateFields = {};

    if (req.body.rating !== undefined) updateFields.rating = req.body.rating;
    if (req.body.reviewText !== undefined) updateFields.reviewText = req.body.reviewText;
    if (req.body.spoiler !== undefined) updateFields.spoiler = req.body.spoiler;

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns the review
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this review' });
    }

    // Update review
    Object.assign(review, updateFields);
    await review.save();

    // Populate user info for response
    await review.populate('user', 'username profilePicture');

    res.json({
      message: 'Review updated successfully',
      review
    });
  } catch (error) {
    console.error('Update review error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid review ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/reviews/:reviewId
// @desc    Delete a review
// @access  Private
router.delete('/:reviewId', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns the review
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    await review.remove();

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid review ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/reviews/:reviewId/reaction
// @desc    Like/dislike a review
// @access  Private
router.post('/:reviewId/reaction', auth, [
  body('reactionType')
    .isIn(['like', 'dislike'])
    .withMessage('Reaction type must be either like or dislike')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { reviewId } = req.params;
    const { reactionType } = req.body;

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user is trying to react to their own review
    if (review.user.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot react to your own review' });
    }

    // Toggle reaction
    await review.toggleReaction(req.user._id, reactionType);

    res.json({
      message: 'Reaction updated successfully',
      review
    });
  } catch (error) {
    console.error('Update reaction error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid review ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
