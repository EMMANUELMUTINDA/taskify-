const express = require('express');
const { submitReview, listReviews } = require('../controllers/reviews.controller');

const router = express.Router();

router.post('/', submitReview);
router.get('/', listReviews);

module.exports = router;
