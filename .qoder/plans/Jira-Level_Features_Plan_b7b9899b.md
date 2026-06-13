# Jira-Level Features Implementation Plan

## Architecture Overview

**Layout Change**: Replace current `TaskEditModal` (small dialog) with a **Right-Side Drawer** that splits the screen. Board stays visible on the left (~60%), drawer slides in from the right (~40%).

**Drawer Tabs**:
- **Details**: Rich description, subtasks checklist, dependencies, all field editors
- **Comments**: Thread with @mentions support
- **Activity**: Audit trail of all changes
- **Files**: Upload/download attachments
- **Time**: Time tracking entries

**New View Tab**: Add "Backlog" tab next to Timeline for Sprint/Backlog management.

---

## Task 1: Database Migration

Create `supabase/migrations/004_jira_features.sql` with:

**New Tables:**
- `task_comments` — id, item_id, user_id, content (text with @mentions), created_at, updated_at
- `task_activity` — id, item_id, user_id, field_name, old_value, new_value, action (created/updated/deleted), created_at
- `task_attachments` — id, item_id, user_id, file_name, file_url, file_size, file_type, created_at
- `task_time_entries` — id, item_id, user_id, duration_minutes, description, date, created_at
- `sprints` — id, board_id, title, status (planning/active/completed), start_date, end_date, created_at
- `task_dependencies` — id, source_item_id, target_item_id, type (blocks/blocked_by)

**Modify `board_items`:**
- Add `description` TEXT DEFAULT ''
- Add `parent_id` UUID (self-reference for subtasks)
- Add `sprint_id` UUID (references sprints)
- Add `story_points` INTEGER DEFAULT 0
- Add `estimate_minutes` INTEGER DEFAULT 0

**RLS policies** for all new tables (owner + member access, same pattern as board_items).

---

## Task 2: API Layer

Create new API files in `src/lib/api/`:

- `comments.js` — CRUD for task_comments, with user profile join for display
- `activity.js` — log() function called from items.update(), list() for activity feed
- `attachments.js` — upload (Supabase Storage), list, delete
- `time.js` — CRUD for task_time_entries, totals per task
- `sprints.js` — CRUD for sprints, move items between sprints

Modify `items.js`:
- `update()` to also log activity (field_name, old_value, new_value)
- Support `parent_id` for subtask queries
- Support `sprint_id` filtering

---

## Task 3: Task Detail Drawer (Core Layout)

Create `src/components/board/drawer/TaskDetailDrawer.jsx`:

- Fixed overlay on right side: `fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-50`
- Backdrop: semi-transparent overlay on left (click to close)
- Header: task title (editable), close button, delete button
- Tab bar: Details | Comments | Activity | Files | Time
- Content area: scrollable, renders active tab content
- Footer: Save/Cancel buttons

Modify `src/screens/Board.jsx`:
- Add `selectedTaskId` state
- When task is clicked, set `selectedTaskId` and open drawer
- Pass `onSelectTask` down through GroupSection to ItemRow
- Render `TaskDetailDrawer` conditionally when `selectedTaskId` is set

Modify `src/components/board/GroupSection.jsx`:
- Make task title row clickable (opens drawer)
- Add click handler on the title area

---

## Task 4: Details Tab

Create `src/components/board/drawer/DetailsTab.jsx`:

- **Rich Description**: Textarea with markdown support (or simple rich text with bold/italic/lists/links using TipTap or a simple textarea with preview)
- **Subtasks Section**: 
  - List of child items (query items where `parent_id = currentTaskId`)
  - Add subtask input
  - Checkbox to mark complete
  - Progress bar (X of Y subtasks done)
- **Dependencies Section**:
  - Show "blocks" and "blocked by" relationships
  - Add dependency selector (search other tasks in board)
- **Field Editors**: Reuse existing field rendering from TaskEditModal but in a cleaner vertical layout

---

## Task 5: Comments Tab

Create `src/components/board/drawer/CommentsTab.jsx`:

- Comment list: avatar + name + timestamp + content
- Comment input: textarea with @mention autocomplete
- @mention: type `@` triggers a dropdown of board members, selecting inserts `[name](user_id)` markup
- Real-time feel: newest comments at bottom (chat-style)
- Edit/delete own comments
- Permission: viewers can read, editors/admins can write

---

## Task 6: Activity Tab

Create `src/components/board/drawer/ActivityTab.jsx`:

- Timeline list: icon + "User changed Field from Old to New" + timestamp
- Grouped by date (Today, Yesterday, Earlier)
- Auto-logged: whenever `handleUpdateItem` is called in Board.jsx, also insert into task_activity
- Actions tracked: field changes, status changes, assignments, task creation, comment added

---

## Task 7: Files Tab

Create `src/components/board/drawer/FilesTab.jsx`:

- File list: icon (by type) + name + size + uploaded by + date
- Upload area: drag-and-drop zone + click to browse
- Storage: Supabase Storage bucket `task-attachments/{board_id}/{item_id}/`
- Delete: only uploader or admin
- Preview: images show thumbnail, other types show icon

---

## Task 8: Time Tracking Tab

Create `src/components/board/drawer/TimeTab.jsx`:

- Timer: Start/Stop button with live elapsed time display
- Manual entry: input hours/minutes + description + date
- Entry list: date, duration, description, user
- Total: sum of all entries for this task
- Simple, no billing/invoicing

---

## Task 9: Sprint / Backlog View

Create `src/components/board/view/SprintView.jsx`:

- Two-panel layout:
  - **Left panel**: Backlog (unsprinted items, drag to reorder/prioritize)
  - **Right panel**: Active Sprint (items in current sprint, grouped by status)
- Sprint header: sprint name, date range, Start/Complete sprint buttons
- Burndown summary: total story points vs completed
- Drag items from Backlog to Sprint
- Add "Backlog" tab in BoardHeader view tabs

Modify `src/components/board/BoardHeader.jsx`:
- Add "Backlog" to the view tabs array

---

## Task 10: Notifications

- Use existing `notifications` table (already exists in DB)
- Trigger notifications for:
  - @mention in comments
  - Task assigned to you
  - Status change on task you're watching
- Show notification bell icon in NavBar with unread count
- Create `src/components/NotificationBell.jsx`
- Simple in-app only (no email for now)

---

## Task 11: Board.jsx Integration

Modify `src/screens/Board.jsx`:
- Add `selectedTaskId` state + drawer rendering
- Wire up `onSelectTask` callback through all views (table, kanban, calendar, timeline)
- On field update: log activity automatically
- Add Sprint view rendering
- Add notification bell to board header

---

## Implementation Order

1. **DB migration** (foundation for everything)
2. **API layer** (all new + modify items.js for activity logging)
3. **TaskDetailDrawer** (layout shell with tab navigation)
4. **DetailsTab** (description + subtasks + dependencies + fields)
5. **CommentsTab** (comments + @mentions)
6. **ActivityTab** (audit trail)
7. **FilesTab** (attachments)
8. **TimeTab** (time tracking)
9. **SprintView** (backlog + sprint management)
10. **Notifications** (bell + in-app alerts)
11. **Board.jsx integration** (wire everything together)

Each task builds on the previous. We will implement one at a time, verify it works, then move to the next.
