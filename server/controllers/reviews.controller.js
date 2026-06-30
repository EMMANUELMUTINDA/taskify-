const { pool } = require('../config/db');

const submitReview = async (req, res) => {
  try {
    const { reviewedUserID, projectID, rating, comment, isAnonymous } = req.body;
    const reviewerID = req.user.userID;

    if (!reviewedUserID || !projectID || !rating) {
      return res.status(400).json({ message: 'reviewedUserID, projectID, and rating are required' });
    }

    const normalizedRating = Number(rating);
    if (Number.isNaN(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({ message: 'rating must be a number between 1 and 5' });
    }

    if (Number(reviewerID) === Number(reviewedUserID)) {
      return res.status(400).json({ message: 'You cannot review yourself' });
    }

    const [existing] = await pool.query(
      `SELECT reviewID
       FROM peer_reviews
       WHERE reviewerID = ? AND reviewedUserID = ? AND projectID = ?
       LIMIT 1`,
      [reviewerID, reviewedUserID, projectID]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: 'You have already reviewed this member for this project',
      });
    }

    const [result] = await pool.query(
      `INSERT INTO peer_reviews (reviewerID, reviewedUserID, projectID, rating, comment, isAnonymous)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        reviewerID,
        reviewedUserID,
        projectID,
        normalizedRating,
        comment || null,
        typeof isAnonymous === 'boolean' ? Number(isAnonymous) : 1,
      ]
    );

    await pool.query(
      `INSERT INTO activity_events (userID, projectID, eventType, sourceID, scoreImpact)
       VALUES (?, ?, 'ReviewSubmitted', ?, 1.50)`,
      [reviewerID, projectID, result.insertId]
    );

    return res.status(201).json({ reviewID: result.insertId, message: 'Peer review submitted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit peer review', error: error.message });
  }
};

const listReviews = async (req, res) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ message: 'projectId query parameter is required' });
    }

    const [rows] = await pool.query(
      `SELECT pr.reviewID, pr.reviewerID, pr.reviewedUserID, pr.projectID, pr.rating, pr.comment,
              pr.isAnonymous, pr.submittedAt, reviewed.name AS reviewedName,
              CASE WHEN pr.isAnonymous = 1 THEN 'Anonymous' ELSE reviewer.name END AS reviewerName
       FROM peer_reviews pr
       JOIN users reviewed ON reviewed.userID = pr.reviewedUserID
       JOIN users reviewer ON reviewer.userID = pr.reviewerID
       WHERE pr.projectID = ?
       ORDER BY pr.submittedAt DESC`,
      [projectId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load peer reviews', error: error.message });
  }
};

module.exports = {
  submitReview,
  listReviews,
};
