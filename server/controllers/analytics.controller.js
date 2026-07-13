const { pool } = require('../config/db');
const PDFDocument = require('pdfkit');

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

  const [[workUpdateRow]] = await pool.query(
    `SELECT COUNT(*) AS workUpdatesCount
     FROM project_messages
     WHERE projectID = ?
       AND userID = ?
       AND CHAR_LENGTH(message) >= 120`,
    [projectId, userId]
  );

  const assigned = Number(assignedRow.assignedCount || 0);
  const completed = Number(completedRow.completedCount || 0);
  const onTime = Number(onTimeRow.onTimeCount || 0);
  const avgRating = Number(peerRow.avgRating || 0);
  const updatesCount = Number(collabRow.updatesCount || 0);
  const workUpdatesCount = Number(workUpdateRow.workUpdatesCount || 0);

  const completionRate = assigned === 0 ? 0 : (completed / assigned) * 100;
  const timeliness = completed === 0 ? 0 : (onTime / completed) * 100;
  const peerRating = clamp(avgRating * 20, 0, 100);
  const collaboration = clamp(updatesCount * 8 + workUpdatesCount * 12, 0, 100);

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

const canAccessProjectAnalytics = async (projectId, userId, role) => {
  if (role === 'Supervisor') {
    const [ownedProject] = await pool.query(
      `SELECT projectID
       FROM projects
       WHERE projectID = ? AND createdBy = ?
       LIMIT 1`,
      [projectId, userId]
    );

    return ownedProject.length > 0;
  }

  const [membership] = await pool.query(
    `SELECT projectID
     FROM project_members
     WHERE projectID = ? AND userID = ?
     LIMIT 1`,
    [projectId, userId]
  );

  return membership.length > 0;
};

const toSafeFilename = (value) =>
  String(value || 'project-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project-report';

const downloadProjectReportPdf = async (req, res) => {
  try {
    const { projectId } = req.params;
    const requesterId = Number(req.user?.userID || 0);
    const requesterRole = req.user?.role;

    const hasAccess = await canAccessProjectAnalytics(projectId, requesterId, requesterRole);
    if (!hasAccess) {
      return res.status(403).json({ message: 'You are not allowed to download this project report' });
    }

    const [[projectRow]] = await pool.query(
      `SELECT projectID, title
       FROM projects
       WHERE projectID = ?
       LIMIT 1`,
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
      `SELECT pm.userID, pm.roleInProject, u.name
       FROM project_members pm
       JOIN users u ON u.userID = pm.userID
       WHERE pm.projectID = ?
       ORDER BY u.name ASC`,
      [projectId]
    );

    const memberScores = await Promise.all(
      members.map(async (member) => {
        const scoreData = await calcMemberScore(projectId, member.userID);
        return {
          name: member.name,
          roleInProject: member.roleInProject,
          score: scoreData.score,
          breakdown: scoreData.breakdown,
        };
      })
    );

    const teamAverageScore = memberScores.length
      ? memberScores.reduce((sum, member) => sum + Number(member.score || 0), 0) / memberScores.length
      : 0;

    const [alerts] = await pool.query(
      `SELECT la.alertID, u.name, la.scoreAtTrigger, la.threshold, la.triggeredAt
       FROM loafing_alerts la
       JOIN users u ON u.userID = la.userID
       WHERE la.projectID = ? AND la.resolved = 0
       ORDER BY la.triggeredAt DESC`,
      [projectId]
    );

    const filename = `${toSafeFilename(projectRow.title)}-report.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(20).text('Taskify Project Report');
    doc.moveDown(0.3);
    doc.fontSize(12).text(`Project: ${projectRow.title}`);
    doc.text(`Generated at: ${new Date().toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(14).text('Overview', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(11).text(`Overall progress: ${Number(progressRow.overallProgressPct || 0).toFixed(1)}%`);
    doc.text(`Team average score: ${Number(teamAverageScore || 0).toFixed(1)}%`);
    doc.text(`Member count: ${members.length}`);
    doc.text(`Active alerts: ${alerts.length}`);
    doc.moveDown();

    doc.fontSize(14).text('Member Performance', { underline: true });
    doc.moveDown(0.4);

    if (memberScores.length === 0) {
      doc.fontSize(11).text('No members assigned to this project yet.');
    } else {
      memberScores.forEach((member, index) => {
        if (doc.y > 730) {
          doc.addPage();
        }

        doc
          .fontSize(11)
          .text(
            `${index + 1}. ${member.name} (${member.roleInProject}) - Score ${member.score.toFixed(1)}%`
          );
        doc
          .fontSize(10)
          .fillColor('#555555')
          .text(
            `Completion ${member.breakdown.completionRate}% | Timeliness ${member.breakdown.timeliness}% | Peer ${member.breakdown.peerRating}% | Collaboration ${member.breakdown.collaboration}%`
          )
          .fillColor('#000000');
        doc.moveDown(0.35);
      });
    }

    doc.moveDown(0.5);
    doc.fontSize(14).text('Active Alerts', { underline: true });
    doc.moveDown(0.4);

    if (alerts.length === 0) {
      doc.fontSize(11).text('No active alerts.');
    } else {
      alerts.forEach((alert, index) => {
        if (doc.y > 730) {
          doc.addPage();
        }

        doc
          .fontSize(11)
          .text(
            `${index + 1}. ${alert.name} - Score ${Number(alert.scoreAtTrigger || 0).toFixed(1)}% (threshold ${Number(alert.threshold || 0).toFixed(1)}%)`
          );
        doc.fontSize(10).fillColor('#555555').text(`Triggered: ${new Date(alert.triggeredAt).toLocaleString()}`).fillColor('#000000');
        doc.moveDown(0.35);
      });
    }

    doc.end();
    return undefined;
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Failed to generate PDF report', error: error.message });
    }

    return undefined;
  }
};

module.exports = {
  getProjectOverview,
  getMemberAnalytics,
  listProjectAlerts,
  downloadProjectReportPdf,
};
