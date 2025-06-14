#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { noteService } from './services/noteService.js';

// Create MCP server
const server = new McpServer({
  name: 'noteplan-mcp',
  version: '1.0.0',
});

// Tool: Get all notes
server.tool(
  'get_notes',
  {
    description: 'Get all notes from NotePlan',
  },
  async () => {
    const notes = noteService.getAllNotes();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(notes, null, 2),
        },
      ],
    };
  }
);

// Tool: Get note by ID
server.tool(
  'get_note_by_id',
  {
    description: 'Get a specific note by its ID',
    inputSchema: z.object({
      id: z.string().describe('The ID of the note to retrieve'),
    }),
  },
  async ({ id }) => {
    const note = noteService.getNoteById(id);
    if (!note) {
      throw new Error(`Note not found with id: ${id}`);
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(note, null, 2),
        },
      ],
    };
  }
);

// Tool: Search notes
server.tool(
  'search_notes',
  {
    description: 'Search notes by query string',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
    }),
  },
  async ({ query }) => {
    const results = noteService.searchNotes(query);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }
);

// Tool: Get notes by folder
server.tool(
  'get_notes_by_folder',
  {
    description: 'Get notes from a specific folder',
    inputSchema: z.object({
      folder: z.string().describe('The folder name to search in'),
    }),
  },
  async ({ folder }) => {
    const notes = noteService.getNotesByFolder(folder);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(notes, null, 2),
        },
      ],
    };
  }
);

// Tool: Create note
server.tool(
  'create_note',
  {
    description: 'Create a new note',
    inputSchema: z.object({
      title: z.string().describe('The title of the note'),
      content: z.string().optional().describe('The content of the note'),
      folder: z.string().optional().describe('The folder to create the note in'),
    }),
  },
  async ({ title, content, folder }) => {
    const newNote = noteService.createNote({ title, content, folder });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(newNote, null, 2),
        },
      ],
    };
  }
);

// Tool: Create daily note
server.tool(
  'create_daily_note',
  {
    description: 'Create a daily note for today or a specific date',
    inputSchema: z.object({
      date: z.string().optional().describe('The date for the daily note (YYYY-MM-DD format)'),
      content: z.string().optional().describe('Initial content for the daily note'),
    }),
  },
  async ({ date, content }) => {
    const dailyNote = noteService.createDailyNote({ date, content });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(dailyNote, null, 2),
        },
      ],
    };
  }
);

// Tool: Update note
server.tool(
  'update_note',
  {
    description: 'Update an existing note',
    inputSchema: z.object({
      id: z.string().describe('The ID of the note to update'),
      title: z.string().optional().describe('New title for the note'),
      content: z.string().optional().describe('New content for the note'),
    }),
  },
  async ({ id, title, content }) => {
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    
    const updatedNote = noteService.updateNote(id, updates);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(updatedNote, null, 2),
        },
      ],
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('NotePlan MCP server running on stdio');
}

main().catch(console.error);