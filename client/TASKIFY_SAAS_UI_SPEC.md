# Taskify SaaS Dashboard UI Spec

## Goal
Reframe Taskify into a modern analytics-first SaaS experience inspired by high-end web analytics dashboards, while preserving current backend endpoints and role logic.

This spec is tailored to the existing pages and data flows in:
- src/pages/Dashboard.js
- src/pages/Tasks.js
- src/pages/Alerts.js
- src/pages/Collaboration.js
- src/components/Sidebar.js
- src/styles/main.css

## Design Direction
- Product feel: Executive analytics cockpit for contribution intelligence.
- Visual tone: Clean, layered, soft glow surfaces, high readability.
- Information architecture: KPI-first, then diagnostics, then action tables.
- Core principle: Every screen answers What is happening, Why it matters, and What to do next.

## 1) Color System
Use CSS variables so theming can be applied globally with minimal refactor.

Base surface and text:
- --bg-canvas: #f4f7fb
- --bg-shell: linear-gradient(180deg, #f7faff 0%, #eff4fb 100%)
- --panel: #ffffff
- --panel-elevated: #f9fcff
- --text-primary: #0f172a
- --text-secondary: #4b5563
- --text-muted: #7b8794
- --border-soft: #e4eaf2

Brand and state:
- --brand-500: #0b6bcb
- --brand-600: #0857a7
- --accent-cyan: #00a3b8
- --success-500: #0f9f6e
- --warning-500: #e29b0f
- --danger-500: #dc4f4f
- --risk-low: #d7f4e6
- --risk-mid: #fff4d4
- --risk-high: #ffdfe0

Chart palette:
- --chart-1: #0b6bcb
- --chart-2: #00a3b8
- --chart-3: #0f9f6e
- --chart-4: #e29b0f
- --chart-5: #dc4f4f

Shadows and effects:
- --shadow-sm: 0 4px 12px rgba(15, 23, 42, 0.06)
- --shadow-md: 0 10px 30px rgba(15, 23, 42, 0.10)
- --glass-outline: 1px solid rgba(255,255,255,0.7)

## 2) Typography and Spacing
Typography:
- Heading family: Sora, sans-serif
- Body family: Manrope, sans-serif
- Numeric/KPI family: Space Grotesk, sans-serif

Scale:
- H1: 34/40, weight 700
- H2: 24/30, weight 700
- H3: 18/24, weight 600
- Body: 14/22, weight 500
- Caption: 12/18, weight 500

Spacing system:
- 4, 8, 12, 16, 20, 24, 32, 40
- Card radius: 16
- Pill radius: 999

## 3) Shell Layout
Global app shell:
- Left rail sidebar remains, but becomes compact and elevated.
- Main area uses 12-column grid.
- Top bar includes page title, context filter (project/role), quick actions.

Desktop:
- Sidebar: 250px
- Content max width: 1440px
- Gutter: 24px

Mobile:
- Sidebar collapses to top drawer.
- KPI cards stack 1 per row.
- Data tables become card lists.

## 4) Component Kit
Create reusable UI primitives in src/components/ui.

Core components:
- StatCard
  - Props: label, value, delta, trend, icon, tone
  - Usage: dashboard KPI strip

- InsightCard
  - Props: title, description, severity, actionLabel, onAction
  - Usage: recommendation panel for supervisors

- SectionCard
  - Standard surface wrapper with header + body + actions slot

- DataTable
  - Features: sticky header, sort state, empty state, loading skeleton
  - Variants: compact, roomy

- StatusPill
  - Supports: Todo, InProgress, Done, Backlog, AlertResolved, AlertActive

- ProgressRing and ProgressBar
  - Usage: project health, contribution completion

- RiskBadge
  - Values: low, medium, high

- ActivityFeed
  - Timeline rows with actor, event, timestamp

- Composer
  - Unified input footer for chat/comments

- EmptyState
  - Icon, title, subtitle, optional CTA

- FilterBar
  - Search, chips, date range, project selector

## 5) Motion and Interaction
- On page load:
  - Stagger KPI cards with 40ms delay increments.
  - Charts fade in and rise 8px.

- Hover:
  - Cards lift by 2px, shadow transitions to shadow-md.

- State transitions:
  - Table row background pulse on successful task status updates.
  - Toast notifications slide from top-right.

- Duration and easing:
  - 180ms to 260ms
  - cubic-bezier(0.2, 0.8, 0.2, 1)

## 6) Screen-by-Screen Wireframes

### A) Dashboard (src/pages/Dashboard.js)
Current data available:
- totalProjects
- totalMembers
- activeAlerts
- avgProgress
- per-project overview rows

Target layout:
- Row 1: 4 StatCards (Projects, Members, Active Alerts, Avg Progress)
- Row 2:
  - Left (8 cols): Project Health trend chart + table summary
  - Right (4 cols): Insight stack (Top risk project, Team imbalance, Suggested action)
- Row 3:
  - Contribution heat matrix by project/member (derived from existing overview + contributions endpoints)

Actions:
- Quick actions in header: Create project, Add member, Export snapshot.

### B) Tasks (src/pages/Tasks.js)
Current capabilities:
- Create task
- Assign user
- Change task status
- Project filter

Target layout:
- Header: title + project selector + quick filter chips
- Left panel (5 cols): Create/Edit task drawer card
- Right panel (7 cols): Kanban lanes for Todo/In Progress/Done/Backlog
- Secondary section: Table mode toggle for dense management

Functionality upgrades from template pattern:
- Add inline assignee avatars.
- Add deadline urgency color coding.
- Add bulk actions (status update, reassign).

### C) Alerts (src/pages/Alerts.js)
Current capabilities:
- List active alerts
- Resolve alert for admins

Target layout:
- Row 1 KPIs: Active alerts, High-risk members, Resolved this week
- Row 2 split:
  - Left: Priority queue list with risk badges and score deltas
  - Right: Alert context panel (member timeline + project health mini-chart)
- Row 3: Resolution log table with filters

Functionality upgrades from template pattern:
- Severity tabs (All, High, Medium, Low)
- SLA timers per alert
- Resolve modal with required note

### D) Collaboration (src/pages/Collaboration.js)
Current capabilities:
- Upload assignments
- Download files
- Team tasks status edits
- Project chat

Target layout:
- 3-column workspace:
  - Left (3 cols): Project members and quick stats
  - Center (5 cols): Chat and activity feed
  - Right (4 cols): Assignments and task status module

Module details:
- Chat: sticky composer, message grouping, unread divider
- Assignments: file tiles with type icon, uploader, date, quick download
- Tasks mini-board: status selectors with progress bars

Functionality upgrades from template pattern:
- Mention support in chat
- File preview panel (pdf/doc/image)
- Activity feed that merges upload, status change, and message events

## 7) Role-Based UX Mapping
- Supervisor:
  - Full analytics and resolve actions
  - Visibility across projects

- GroupLeader:
  - Project-level analytics and task orchestration
  - Can update all team tasks

- Member:
  - Personal performance and assigned work focus
  - Can update own tasks only

## 8) Data Contract Alignment (No Backend Rewrite Needed)
Existing endpoints already support most of this UI:
- Dashboard KPIs and overview: /analytics/projects/:projectId/overview + project list
- Tasks CRUD/status: /tasks
- Alerts list/resolve: /alerts
- Collaboration: /collab projects assignments messages

Frontend-only additions:
- Aggregation helpers for chart datasets
- Client-side derived metrics (trend deltas, urgency states)

## 9) Implementation Order for Current Codebase

Phase 1: Design tokens and shell
1. Add CSS token layer in src/styles/main.css.
2. Restyle Sidebar for elevated SaaS shell.
3. Introduce shared card, pill, button variants.

Phase 2: Reusable UI primitives
1. Create src/components/ui/StatCard.js, SectionCard.js, StatusPill.js.
2. Create DataTable wrapper and EmptyState component.
3. Migrate existing page tables to DataTable.

Phase 3: Dashboard redesign
1. Replace stats-grid with StatCard strip.
2. Add insights panel and placeholder chart containers.
3. Integrate existing overview data into chart-friendly shape.

Phase 4: Tasks redesign
1. Add view toggle (board/table).
2. Build kanban lanes by status.
3. Preserve create task flow and status update logic.

Phase 5: Alerts redesign
1. Add severity tabs and KPI header.
2. Convert alert rows into queue cards.
3. Add resolve modal and log section.

Phase 6: Collaboration redesign
1. Move to 3-column layout.
2. Upgrade chat module and assignment cards.
3. Add unified activity feed.

Phase 7: Responsiveness and polish
1. Add mobile breakpoints for all four pages.
2. Add motion transitions and skeleton loading states.
3. Accessibility pass (focus states, contrast, keyboard interactions).

Phase 8: Readiness checks
1. Ensure npm run build passes in client.
2. Verify all routes and role guards.
3. Verify no regression in token-auth API calls.

## 10) Immediate Quick Wins (1-2 days)
- Apply tokenized color and typography system.
- Upgrade Dashboard KPI cards and Alerts list style.
- Add status pills and urgency coloring in Tasks.
- Restyle Collaboration into clear card hierarchy.

## 11) Success Metrics
- Time to identify at-risk member reduced by at least 40 percent.
- Time to update task status reduced by at least 25 percent.
- Supervisor alert resolution turnaround improved week over week.
- User-reported UI clarity score above 8/10 in pilot feedback.

## 12) Notes for Next Implementation Step
Before coding this new UI, resolve current compile blocker:
- src/pages/Assignments.js is referenced by App routing but does not exist.

After this blocker is fixed, implement Phase 1 and Phase 2 first to avoid duplicated styling work.
