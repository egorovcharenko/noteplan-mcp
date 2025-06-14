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

2. **Test the server**:
   ```bash
   npm start
   ```
   You should see: "NotePlan MCP server running on stdio"

3. **Configure Claude Desktop** (see detailed setup below)

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
      "args": ["/absolute/path/to/noteplan-mcp/src/mcp-server.js"],
      "cwd": "/absolute/path/to/noteplan-mcp"
    }
  }
}
```

**Important**: Replace `/absolute/path/to/noteplan-mcp` with the actual path where you cloned this repository.

### Step 3: Restart Claude Desktop

After saving the configuration, restart Claude Desktop completely for the changes to take effect.

## Available Tools

Once configured, you can use these tools in Claude conversations:

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_notes` | Get all notes from NotePlan | None |
| `get_note_by_id` | Get a specific note by ID | `id` (required) |
| `search_notes` | Search notes by query | `query` (required) |
| `get_notes_by_folder` | Get notes from a folder | `folder` (required) |
| `create_note` | Create a new note | `title` (required), `content`, `folder` |
| `create_daily_note` | Create a daily note | `date` (YYYY-MM-DD), `content` |
| `update_note` | Update existing note | `id` (required), `title`, `content` |

## Example Usage in Claude

Once set up, you can ask Claude things like:

- "Show me all my notes"
- "Search for notes containing 'project planning'"
- "Create a new note titled 'Meeting Notes' in the 'Work' folder"
- "Get today's daily note"
- "Update note ID 'note123' with new content"

Claude will automatically use the appropriate NotePlan MCP tools to fulfill these requests.

## Development

### Development Mode
```bash
npm run dev
```
This starts the server with auto-restart on file changes using nodemon.

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
│   ├── mcp-server.js          # Main MCP server implementation
│   ├── index.js               # HTTP server (alternative)
│   └── services/
│       └── noteService.js     # Note management logic
├── tests/
│   └── index.test.js          # Test files
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
   npm start
   ```

2. Check Claude Desktop logs for connection status

3. Try a simple command in Claude: "Can you show me my notes?"

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