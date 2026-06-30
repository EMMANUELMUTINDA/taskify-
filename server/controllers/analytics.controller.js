const { pool } = require('../config/db');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const calcMemberScore = async (projectId, userId) => {
  const [[assignedRow]] = await pool.query(
    `SELECT COUNT(*) AS assignedCount
     FROM tasks
     WHERE projectID = ? AND assignedTo = ?`,
    [projectId, userId]
  );

  const [[completedRow]] = await pool.query(
    `SELECT COUNT(*) AS completedCount
     FROM tasks
     WHERE projectID = ? AND assignedTo = ? AND status = 'Done'`,
    [projectId, userId]
  );

  const [[onTimeRow]] = await pool.query(
    `SELECT COUNT(*) AS onTimeCount
     FROM tasks
     WHERE projectID = ?
       AND assignedTo = ?
       AND status = 'Done'
       AND (deadline IS NULL OR DATE(updatedAt) <= deadline)`,
    [projectId, userId]
  );

  const [[peerRow]] = await pool.query(
    `SELECT AVG(rating) AS avgRating
     FROM peer_reviews
     WHERE projectID = ? AND reviewedUserID = ?`,
    [projectId, userId]
  );

  const [[collabRow]] = await pool.query(
    `SELECT COUNT(*) AS updatesCount
     FROM task_updates tu
     JOIN tasks t ON t.taskID = tu.taskID
     WHERE t.projectID = ? AND tu.userID = ?`,
    [projectId, userId]
  );

  const assigned = Number(assignedRow.assignedCount || 0);
  const completed = Number(completedRow.completedCount || 0);
  const onTime = Number(onTimeRow.onTimeCount || 0);
  const avgRating = Number(peerRow.avgRating || 0);
  const updatesCount = Number(collabRow.updatesCount || 0);

  const completionRate = assigned === 0 ? 0 : (completed / assigned) * 100;
  const timeliness = completed === 0 ? 0 : (onTime / completed) * 100;
  const peerRating = clamp(avgRating * 20, 0, 100);
  const collaboration = clamp(updatesCount * 10, 0, 100);

  const score =
    0.35 * completionRate +
    0.25 * timeliness +
    0.2 * peerRating +
    0.2 * collaboration;

  return {
    score: Number(score.toFixed(1)),
    breakdown: {
      completionRate: Number(completionRate.toFixed(1)),
      timeliness: Number(timeliness.toFixed(1)),
      peerRating: Number(peerRating.toFixed(1)),
      collaboration: Number(collaboration.toFixed(1)),
    },
  };
};

const getProjectOverview = async (req, res) => {
  try {
    const { projectId } = req.params;

    const [[projectRow]] = await pool.query(
      `SELECT projectID, title FROM projects WHERE projectID = ?`,
      [projectId]
    );

    if (!projectRow) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const [[progressRow]] = await pool.query(
      `SELECT COALESCE(AVG(progressPct), 0) AS overallProgressPct
       FROM tasks
       WHERE projectID = ?`,
      [projectId]
    );

    const [members] = await pool.query(
      `SELECT userID FROM project_members WHERE projectID = ?`,
      [projectId]
    );

    let teamAverageScore = 0;
    if (members.length > 0) {
      const scores = await Promise.all(
        members.map((m) => calcMemberScore(projectId, m.userID))
      );
      const total = scores.reduce((sum, s) => sum + s.score, 0);
      teamAverageScore = total / scores.length;
    }

    const [[alertsRow]] = await pool.query(
      `SELECT COUNT(*) AS activeAlerts
       FROM loafing_alerts
       WHERE projectID = ? AND resolved = 0`,
      [projectId]
    );

    return res.json({
      projectId: Number(projectId),
      projectTitle: projectRow.title,
      overallProgressPct: Number(Number(progressRow.overallProgressPct || 0).toFixed(1)),
      teamAverageScore: Number(teamAverageScore.toFixed(1)),
      memberCount: members.length,
      activeAlerts: Number(alertsRow.activeAlerts || 0),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load project overview', error: error.message });
  }
};

const getMemberAnalytics = async (req, res) => {
  try {
    const { projectId, userId } = req.params;

    const [[userRow]] = await pool.query(
      `SELECT userID, name FROM users WHERE userID = ?`,
      [userId]
    );

    if (!userRow) {
      return res.status(404).json({ message: 'User not found' });
    }

    const scoreData = await calcMemberScore(projectId, userId);

    const [[lastActiveRow]] = await pool.query(
      `SELECT MAX(createdAt) AS lastActiveAt
       FROM activity_events
       WHERE projectID = ? AND userID = ?`,
      [projectId, userId]
    );

    const risk = Number((100 - scoreData.score).toFixed(1));

    return res.json({
      userId: Number(userId),
      name: userRow.name,
      score: scoreData.score,
      risk,
      breakdown: scoreData.breakdown,
      lastActiveAt: lastActiveRow.lastActiveAt,
      trend: [
        Number(clamp(scoreData.score - 4, 0, 100).toFixed(1)),
        Number(clamp(scoreData.score - 2, 0, 100).toFixed(1)),
        scoreData.score,
      ],
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load member analytics', error: error.message });
  }
};

const listProjectAlerts = async (req, res) => {
  try {
    const { projectId } = req.params;

    const [rows] = await pool.query(
      `SELECT la.alertID, la.userID, u.name, la.projectID, la.scoreAtTrigger,
              la.threshold, la.triggeredAt, la.resolved, la.resolvedAt
       FROM loafing_alerts la
       JOIN users u ON u.userID = la.userID
       WHERE la.projectID = ?
       ORDER BY la.triggeredAt DESC`,
      [projectId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load alerts', error: error.message });
  }
};

module.exports = {
  getProjectOverview,
  getMemberAnalytics,
  listProjectAlerts,
};
