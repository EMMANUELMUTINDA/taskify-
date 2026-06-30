# Taskify Group Work Monitoring - Implementation Plan

## Goal
Build an MVP system that monitors group work fairly, detects social loafing risk early, and provides explainable evidence to supervisors and group leaders.

## Current Baseline
- Database schema exists with users, projects, tasks, contribution_logs, peer_reviews, loafing_alerts.
- Backend server is running with database connectivity.
- No route/controller modules are implemented yet.
- Frontend is still the default Create React App screen.

## Phase 1 - Data Model Upgrade (Day 1)

### 1.1 Add membership and activity tables
Add these tables to schema:

```sql
CREATE TABLE IF NOT EXISTS project_members (
  projectMemberID INT AUTO_INCREMENT PRIMARY KEY,
  projectID INT NOT NULL,
  userID INT NOT NULL,
  roleInProject ENUM('Leader','Member') DEFAULT 'Member',
  joinedAt DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_project_user (projectID, userID),
  FOREIGN KEY (projectID) REFERENCES projects(projectID),
  FOREIGN KEY (userID) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS task_updates (
  updateID INT AUTO_INCREMENT PRIMARY KEY,
  taskID INT NOT NULL,
  userID INT NOT NULL,
  updateType ENUM('Comment','Progress','StatusChange','Blocker','Attachment') NOT NULL,
  note TEXT,
  progressDelta TINYINT DEFAULT 0,
  createdAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (taskID) REFERENCES tasks(taskID),
  FOREIGN KEY (userID) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS activity_events (
  eventID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  projectID INT NOT NULL,
  eventType ENUM('TaskCreated','TaskUpdated','TaskCompleted','ReviewSubmitted','CommentAdded') NOT NULL,
  sourceID INT,
  scoreImpact DECIMAL(5,2) DEFAULT 0,
  createdAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (userID) REFERENCES users(userID),
  FOREIGN KEY (projectID) REFERENCES projects(projectID)
);
```

### 1.2 Add useful indexes

```sql
CREATE INDEX idx_tasks_project_status ON tasks(projectID, status);
CREATE INDEX idx_updates_task_created ON task_updates(taskID, createdAt);
CREATE INDEX idx_events_project_user_date ON activity_events(projectID, userID, createdAt);
CREATE INDEX idx_peer_reviews_project_user ON peer_reviews(projectID, reviewedUserID);
```

## Phase 2 - Backend API Foundation (Day 1-2)

### 2.1 Create module structure
- server/routes/projects.routes.js
- server/routes/tasks.routes.js
- server/routes/analytics.routes.js
- server/controllers/projects.controller.js
- server/controllers/tasks.controller.js
- server/controllers/analytics.controller.js

### 2.2 Register routes in server entry
Mount route groups:
- /api/projects
- /api/tasks
- /api/analytics

### 2.3 Minimum endpoints

Projects and membership
- POST /api/projects
- GET /api/projects
- GET /api/projects/:projectId
- POST /api/projects/:projectId/members
- GET /api/projects/:projectId/members

Tasks
- POST /api/tasks
- GET /api/tasks?projectId=...
- PATCH /api/tasks/:taskId/status
- POST /api/tasks/:taskId/updates
- GET /api/tasks/:taskId/updates

Monitoring and scoring
- GET /api/analytics/projects/:projectId/overview
- GET /api/analytics/projects/:projectId/members/:userId
- GET /api/analytics/projects/:projectId/alerts

## Phase 3 - Scoring and Alert Rules (Day 2)

### 3.1 Weekly contribution score (MVP)
For each member per project:

Score = 0.35 * completionRate + 0.25 * timeliness + 0.20 * peerRating + 0.20 * collaboration

Normalize each component to 0-100.
- completionRate: completed tasks vs assigned tasks
- timeliness: on-time completions vs completed tasks
- peerRating: average rating mapped to 0-100
- collaboration: meaningful updates/comments/reviews count normalized to team baseline

### 3.2 Alert policy
Create loafing alerts when:
- Risk (100 - score) >= 70 for 2 consecutive weeks
- OR no task update activity for 5 days during active project

Alert payload should include explanation fields:
- triggeredReasons
- scoreAtTrigger
- metricsSnapshot

## Phase 4 - Frontend MVP Screens (Day 2-3)

### 4.1 Screen list
1. Project List
2. Project Details
3. Team Monitoring Dashboard
4. Member Profile and Trend
5. Alerts Center

### 4.2 Suggested component map (React)
- client/src/pages/ProjectListPage.js
- client/src/pages/ProjectDetailsPage.js
- client/src/pages/MonitoringDashboardPage.js
- client/src/pages/MemberInsightsPage.js
- client/src/pages/AlertsPage.js
- client/src/components/ScoreCard.js
- client/src/components/MetricTile.js
- client/src/components/AlertTable.js
- client/src/services/api.js

### 4.3 Core frontend interactions
- Create project and assign members
- Create tasks and update status
- Add task updates (progress notes)
- View team score leaderboard
- View generated loafing alerts with explanations

## Phase 5 - Validation and Demo Readiness (Day 3)

### 5.1 Seed and test data
Seed data for:
- 2 projects
- 8 users
- 20 tasks
- 40 task updates
- 12 peer reviews

### 5.2 Acceptance checks
- Project dashboard loads in under 2 seconds on local data volume
- Member score updates after status/update actions
- Alerts are explainable and reproducible
- No hard crash when any metric source is missing (graceful defaults)

## API Response Shapes (MVP)

### GET /api/analytics/projects/:projectId/overview
```json
{
  "projectId": 1,
  "projectTitle": "Capstone Team A",
  "overallProgressPct": 62,
  "teamAverageScore": 71.4,
  "memberCount": 5,
  "activeAlerts": 2,
  "generatedAt": "2026-06-23T10:30:00Z"
}
```

### GET /api/analytics/projects/:projectId/members/:userId
```json
{
  "userId": 3,
  "name": "Alex",
  "score": 66.2,
  "risk": 33.8,
  "breakdown": {
    "completionRate": 70,
    "timeliness": 62,
    "peerRating": 74,
    "collaboration": 58
  },
  "lastActiveAt": "2026-06-22T18:12:00Z",
  "trend": [62.1, 64.8, 66.2]
}
```

## Implementation Order (Exact)
1. Update schema with new tables and indexes.
2. Add backend route/controller files and register them.
3. Implement create/list project and member APIs.
4. Implement create/list/update task APIs.
5. Log task updates and activity events on writes.
6. Implement analytics overview endpoint.
7. Implement member score endpoint.
8. Implement alert generation endpoint.
9. Build frontend pages with API integration.
10. Seed demo data and run end-to-end walkthrough.

## Nice-to-have After MVP
- JWT auth and role-based access per endpoint.
- Scheduled weekly score snapshots table.
- Export alerts/report as CSV.
- Basic anomaly detection on sudden contribution drops.
