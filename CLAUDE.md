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

### Available Tools
- `get_notes` - Get all notes
- `get_note_by_id` - Get specific note (for daily notes use YYYYMMDD format like "20250929")
- `get_todays_note` - Get today's daily note specifically
- `search_notes` - Search notes by content
- `get_notes_by_folder` - Get notes from specific folder
- `create_note` - Create new note
- `create_daily_note` - Create daily note (use YYYY-MM-DD format like "2025-09-29")
- `edit_note` - Edit note by replacing specific text (similar to Edit tool in Claude Code)
- `rename_note` - Rename a note (changes title, filename, and markdown header)
- `move_note` - Move a note to a different folder (use "/" for root, "02. Work" or "02. Work/10. Tasks" for subfolders)
- `update_note` - Update existing note (full content replacement)

### Date Formats
- Daily note IDs use YYYYMMDD format (e.g., "20250929" or "calendar-20250929")
- When creating daily notes, use YYYY-MM-DD format (e.g., "2025-09-29")
- Use `get_todays_note` for current day's note

## Code Style Preferences
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Unix line endings