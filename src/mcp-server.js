#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const noteService = require('./services/noteService');

class NotePlanMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'noteplan-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_notes',
            description: 'Get all notes from NotePlan',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_note_by_id',
            description: 'Get a specific note by its ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'The ID of the note to retrieve',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'search_notes',
            description: 'Search notes by query string',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_notes_by_folder',
            description: 'Get notes from a specific folder',
            inputSchema: {
              type: 'object',
              properties: {
                folder: {
                  type: 'string',
                  description: 'The folder name to search in',
                },
              },
              required: ['folder'],
            },
          },
          {
            name: 'create_note',
            description: 'Create a new note',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'The title of the note',
                },
                content: {
                  type: 'string',
                  description: 'The content of the note',
                },
                folder: {
                  type: 'string',
                  description: 'The folder to create the note in',
                },
              },
              required: ['title'],
            },
          },
          {
            name: 'create_daily_note',
            description: 'Create a daily note for today or a specific date',
            inputSchema: {
              type: 'object',
              properties: {
                date: {
                  type: 'string',
                  description: 'The date for the daily note (YYYY-MM-DD format)',
                },
                content: {
                  type: 'string',
                  description: 'Initial content for the daily note',
                },
              },
            },
          },
          {
            name: 'update_note',
            description: 'Update an existing note',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'The ID of the note to update',
                },
                title: {
                  type: 'string',
                  description: 'New title for the note',
                },
                content: {
                  type: 'string',
                  description: 'New content for the note',
                },
              },
              required: ['id'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_notes':
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(noteService.getAllNotes(), null, 2),
                },
              ],
            };

          case 'get_note_by_id':
            if (!args.id) {
              throw new Error('Missing required parameter: id');
            }
            const note = noteService.getNoteById(args.id);
            if (!note) {
              throw new Error(`Note not found with id: ${args.id}`);
            }
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(note, null, 2),
                },
              ],
            };

          case 'search_notes':
            if (!args.query) {
              throw new Error('Missing required parameter: query');
            }
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(noteService.searchNotes(args.query), null, 2),
                },
              ],
            };

          case 'get_notes_by_folder':
            if (!args.folder) {
              throw new Error('Missing required parameter: folder');
            }
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(noteService.getNotesByFolder(args.folder), null, 2),
                },
              ],
            };

          case 'create_note':
            if (!args.title) {
              throw new Error('Missing required parameter: title');
            }
            const newNote = noteService.createNote(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(newNote, null, 2),
                },
              ],
            };

          case 'create_daily_note':
            const dailyNote = noteService.createDailyNote(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(dailyNote, null, 2),
                },
              ],
            };

          case 'update_note':
            if (!args.id) {
              throw new Error('Missing required parameter: id');
            }
            const { id, ...updates } = args;
            const updatedNote = noteService.updateNote(id, updates);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(updatedNote, null, 2),
                },
              ],
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('NotePlan MCP server running on stdio');
  }
}

// Start the server
if (require.main === module) {
  const server = new NotePlanMCPServer();
  server.run().catch(console.error);
}

module.exports = NotePlanMCPServer;