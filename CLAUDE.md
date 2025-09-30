# NotePlan MCP Server - Claude Memory

## Commands
- Start the server: `npm start`
- Development mode with auto-restart: `npm run dev`
- Run tests: `npm test`
- Lint code: `npm run lint`

## Project Structure
- `/src` - Main source code
- `/tests` - Test files

## MCP Protocol Info
The Message Control Protocol (MCP) server enables Claude to interact with NotePlan through a standardized interface.

### NotePath Structure (Internal)
Notes are internally organized using a typed path system:
- **Type**: Either `'calendar'` (for daily notes) or `'note'` (for regular notes)
- **Path**: The subfolder path within that type

**Internal Examples:**
- Root notes: `{ type: 'note', path: '/' }`
- Work subfolder: `{ type: 'note', path: '02. Work' }`
- Daily notes: `{ type: 'calendar', path: '/' }`

### Folder Paths (User-Facing)
When specifying folder paths in tools:
- **"/"** - Root notes folder (all notes at top level)
- **"02. Work"** - Subfolder within notes
- **"02. Work/10. Tasks"** - Nested subfolder

**Important:** Daily notes (calendar) are NOT accessed via folder paths. Use dedicated tools:
- `create_daily_note` - Create a daily note
- `get_todays_note` - Get today's daily note
- `get_note_by_id` with YYYYMMDD format - Get specific daily note

### Available Tools
- `get_notes` - Get all notes (includes both regular notes and daily notes)
- `get_note_by_id` - Get specific note (for daily notes use YYYYMMDD format like "20250929")
- `get_todays_note` - Get today's daily note
- `search_notes` - Search notes by content (searches both regular notes and daily notes)
- `get_notes_by_folder` - Get notes from specific folder (use "/", "02. Work", etc. - only for regular notes, not daily notes)
- `create_note` - Create new note (use "/" for root, "02. Work" for subfolder)
- `create_daily_note` - Create daily note (use YYYY-MM-DD format like "2025-09-29")
- `edit_note` - Edit note by replacing specific text (works with both regular notes and daily notes)
- `rename_note` - Rename a regular note (cannot rename daily notes)
- `move_note` - Move a regular note to different folder (cannot move daily notes)
- `rename_folder` - Rename a folder (e.g., rename "02. Work" to "03. Projects"). Updates all notes in folder and subfolders.
- `update_note` - Update existing note (works with both regular notes and daily notes)

### Date Formats
- Daily note IDs use YYYYMMDD format (e.g., "20250929" or "calendar-20250929")
- When creating daily notes, use YYYY-MM-DD format (e.g., "2025-09-29")
- Use `get_todays_note` for current day's note

### Important Notes
- Daily notes cannot be moved or renamed - they are date-based and managed automatically
- Daily notes are accessed via dedicated tools, not folder paths
- Regular notes use folder paths: "/", "02. Work", etc.
- All note JSON responses include both `location` (NotePath object) and `folder` (string, shows "[daily-note]" for calendar notes) for compatibility
- Users should never specify "Calendar" as a folder path - it will be rejected

## Code Style Preferences
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Unix line endings