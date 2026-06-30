const { pool } = require('../config/db');

const listActiveAlerts = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT la.alertID, la.userID, u.name AS memberName, la.projectID,
              p.title AS projectTitle, la.scoreAtTrigger, la.threshold,
              la.triggeredAt, la.resolved, la.resolvedAt
       FROM loafing_alerts la
       JOIN users u ON u.userID = la.userID
       JOIN projects p ON p.projectID = la.projectID
       WHERE la.resolved = 0
       ORDER BY la.triggeredAt DESC`
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load alerts', error: error.message });
  }
};

const resolveAlert = async (req, res) => {
  try {
    const { alertId } = req.params;

    const [result] = await pool.query(
      `UPDATE loafing_alerts
       SET resolved = 1,
           resolvedAt = NOW()
       WHERE alertID = ? AND resolved = 0`,
      [alertId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Alert not found or already resolved' });
    }

    return res.json({ message: 'Alert resolved' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to resolve alert', error: error.message });
  }
};

module.exports = {
  listActiveAlerts,
  resolveAlert,
};
