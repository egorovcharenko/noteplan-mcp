# NotePlan MCP Server

A Message Control Protocol (MCP) server that enables Claude Desktop to interact with NotePlan.co. This server provides seamless integration between Claude and your NotePlan notes, allowing you to query, search, create, and update notes directly from Claude conversations.

## Features

- **Read Notes**: Get all notes, specific notes by ID, or notes from specific folders
- **Search**: Full-text search across all your notes
- **Create Notes**: Create new notes with titles, content, and folder organization
- **Daily Notes**: Create and manage daily notes with automatic date formatting
- **Update Notes**: Modify existing note titles and content
- **Folder Organization**: Organize and filter notes by folders

## Installation

### Option 1: Clone from GitHub

```bash
git clone https://github.com/bscott/noteplan-mcp.git
cd noteplan-mcp
npm install
```

### Option 2: Install as NPM Package (Coming Soon)

```bash
npm install -g noteplan-mcp
```

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Test the server**:
   ```bash
   npm start
   ```
   You should see: "NotePlan MCP server running on stdio"

4. **Configure Claude Desktop** (see detailed setup below)

## Claude Desktop Configuration

To use this MCP server with Claude Desktop, add the following configuration to your Claude Desktop config file:

### Step 1: Locate Your Config File

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

### Step 2: Add NotePlan MCP Server

Add this configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "noteplan": {
      "command": "node",
      "args": ["/absolute/path/to/noteplan-mcp/build/index.js"],
      "cwd": "/absolute/path/to/noteplan-mcp"
    }
  }
}
```

**Important**: Replace `/absolute/path/to/noteplan-mcp` with the actual path where you cloned this repository.

### Step 3: Restart Claude Desktop

After saving the configuration, restart Claude Desktop completely for the changes to take effect.

## Folder Organization

NotePlan MCP uses folder paths for regular notes:

- **"/"** - Root notes folder (for notes at the top level)
- **"02. Work"** - Example subfolder within notes
- **"02. Work/10. Tasks"** - Example nested subfolder

**Daily Notes:**
Daily notes are NOT accessed via folder paths. Use dedicated tools:
- `create_daily_note` - Create a daily note
- `get_todays_note` - Get today's daily note
- `get_note_by_id` with YYYYMMDD format - Get specific daily note

**Important:**
- Use `"/"` or leave folder empty when creating notes at the root level
- Daily notes cannot be moved or renamed (they're date-based and auto-managed)
- Never specify "Calendar" as a folder path - it will be rejected

## Available Tools

Once configured, you can use these tools in Claude conversations:

| Tool | Description | Parameters | Notes |
|------|-------------|------------|-------|
| `get_notes` | Get all notes from NotePlan | None | Returns both regular notes and daily notes |
| `get_note_by_id` | Get a specific note by ID | `id` (required) | Use YYYYMMDD format for daily notes |
| `get_note_by_title` | Get a note by exact title | `title` (required) | Case-sensitive exact match |
| `search_notes` | Search notes by query | `query` (required) | Searches both regular and daily notes |
| `get_notes_by_folder` | Get notes from a folder | `folder` (required) | Use "/", "02. Work", etc. Only for regular notes |
| `get_linked_notes` | Extract and resolve note links | `id` (required) | Finds all [[Note Title]] links in a note |
| `create_note` | Create a new note | `title` (required), `content`, `folder` | Use "/" for root, "02. Work" for subfolder |
| `create_daily_note` | Create a daily note | `date` (YYYY-MM-DD), `content` | Creates date-based note |
| `edit_note` | Edit note text | `id`, `old_text`, `new_text`, `replace_all` | Works with both regular and daily notes |
| `rename_note` | Rename a note | `id`, `new_title` | Only for regular notes, not daily notes |
| `move_note` | Move note to folder | `id`, `target_folder` | Only for regular notes, not daily notes |
| `rename_folder` | Rename a folder | `folder_path`, `new_name` | Updates all notes in folder |
| `update_note` | Update existing note | `id` (required), `title`, `content` | Works with both regular and daily notes |

## Example Usage in Claude

Once set up, you can ask Claude things like:

- "Show me all my notes" (returns both regular notes and daily notes)
- "Search for notes containing 'project planning'"
- "Get the note titled 'Metrics for fb303'" (exact title match)
- "Show me all links in today's note" (extracts [[Note Title]] links)
- "Follow the link to [[Project Ideas]]" (resolves wiki-style links)
- "Create a new note titled 'Meeting Notes' in the root folder" (creates at "/")
- "Create a new note titled 'Task List' in the '02. Work' folder"
- "Get today's daily note"
- "Create a daily note for tomorrow"
- "Move note 'note123' to the '02. Work' folder"
- "Rename the '02. Work' folder to '03. Projects'"
- "Show me all notes in the root folder"
- "Update note ID 'note123' with new content"

Claude will automatically use the appropriate NotePlan MCP tools to fulfill these requests.

### Folder Path Examples (Regular Notes Only)
- Root folder: `"/"` or leave empty
- Top-level subfolder: `"02. Work"`
- Nested subfolder: `"02. Work/10. Tasks"`

**Note:** Daily notes are NOT accessed via folder paths. They have dedicated tools.

## Development

### Development Mode
```bash
npm run dev
```
This builds the TypeScript and starts the server with auto-restart on file changes using nodemon.

### Building
```bash
npm run build
```
Compiles TypeScript to JavaScript in the `build/` directory.

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Project Structure

```
noteplan-mcp/
├── src/
│   ├── index.ts               # Main MCP server implementation
│   ├── index.js               # HTTP server (alternative)
│   └── services/
│       └── noteService.ts     # Note management logic
├── build/                     # Compiled JavaScript output
│   ├── index.js               # Compiled MCP server
│   └── services/
│       └── noteService.js     # Compiled note service
├── tests/
│   └── index.test.js          # Test files
├── tsconfig.json              # TypeScript configuration
├── package.json
└── README.md
```

## Troubleshooting

### Claude Desktop Not Connecting

1. **Check file paths**: Ensure the paths in `claude_desktop_config.json` are absolute and correct
2. **Check Node.js**: Make sure Node.js is installed and accessible from your PATH
3. **Check logs**: Look for error messages in Claude Desktop's logs:
   - **macOS**: `~/Library/Logs/Claude/mcp-server-noteplan.log`
   - **Windows**: `%LOCALAPPDATA%\Claude\Logs\mcp-server-noteplan.log`

### Common Error Messages

**"Cannot find module '/src/mcp-server.js'"**
- The path in your config is incorrect. Use absolute paths, not relative ones.

**"Server disconnected"**
- Check that Node.js is installed and the server can start with `npm start`

### Testing Your Setup

1. Test the server manually:
   ```bash
   cd /path/to/noteplan-mcp
   npm run build
   npm start
   ```

2. Use the MCP inspector for debugging:
   ```bash
   npm run inspector
   ```

3. Check Claude Desktop logs for connection status

4. Try a simple command in Claude: "Can you show me my notes?"

## Configuration

### Custom NotePlan Directory

By default, the server looks for NotePlan files in standard locations. If you use a custom directory, you can modify the `noteService.js` file to point to your NotePlan data directory.

### Environment Variables

Currently, no environment variables are required, but future versions may support:
- `NOTEPLAN_DATA_DIR`: Custom NotePlan data directory
- `MCP_LOG_LEVEL`: Logging verbosity

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b my-new-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Run the linter: `npm run lint`
6. Commit your changes: `git commit -am 'Add some feature'`
7. Push to the branch: `git push origin my-new-feature`
8. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- Open an issue on GitHub for bugs or feature requests
- Check the [MCP Documentation](https://modelcontextprotocol.io/) for general MCP questions
- Review Claude Desktop documentation for setup issues