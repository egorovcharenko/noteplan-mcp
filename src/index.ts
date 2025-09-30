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
  {},
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
    id: z.string().describe('The ID of the note to retrieve. For daily notes, use YYYYMMDD format (e.g., 20250929) or calendar-YYYYMMDD'),
  },
  async ({ id }) => {
    const note = noteService.getNoteById(id);
    if (!note) {
      // Provide helpful suggestions for date-like IDs
      let suggestion = '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(id)) {
        const dateStr = id.replace(/-/g, '');
        suggestion = ` Try using "${dateStr}" or "calendar-${dateStr}" format instead.`;
      }
      throw new Error(`Note not found with id: ${id}.${suggestion}`);
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
    query: z.string().describe('The search query'),
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
    folder: z.string().describe('The folder name to search in'),
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
    title: z.string().describe('The title of the note'),
    content: z.string().optional().describe('The content of the note'),
    folder: z.string().optional().describe('The subfolder name within Notes/ (e.g., "02. Work", not "Notes/02. Work"). Leave empty for root Notes folder.'),
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
    date: z.string().optional().describe('The date for the daily note in YYYY-MM-DD format (e.g., 2025-09-29). Defaults to today if not provided.'),
    content: z.string().optional().describe('Initial content for the daily note'),
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

// Tool: Get today's note
server.tool(
  'get_todays_note',
  {},
  async () => {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
    const note = noteService.getNoteById(`calendar-${today}`);
    if (!note) {
      throw new Error(`No daily note found for today (${today}). You can create one using create_daily_note.`);
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

// Tool: Edit note (partial text replacement)
server.tool(
  'edit_note',
  {
    id: z.string().describe('The ID of the note to edit'),
    old_text: z.string().describe('The exact text to find and replace'),
    new_text: z.string().describe('The text to replace it with'),
    replace_all: z.boolean().optional().describe('Replace all occurrences (default: false). If false and multiple occurrences exist, the operation will fail.'),
  },
  async ({ id, old_text, new_text, replace_all = false }) => {
    const editedNote = noteService.editNote(id, { old_text, new_text, replace_all });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(editedNote, null, 2),
        },
      ],
    };
  }
);

// Tool: Rename note
server.tool(
  'rename_note',
  {
    id: z.string().describe('The ID of the note to rename'),
    new_title: z.string().describe('The new title for the note'),
  },
  async ({ id, new_title }) => {
    const renamedNote = noteService.renameNote(id, new_title);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(renamedNote, null, 2),
        },
      ],
    };
  }
);

// Tool: Update note
server.tool(
  'update_note',
  {
    id: z.string().describe('The ID of the note to update'),
    title: z.string().optional().describe('New title for the note'),
    content: z.string().optional().describe('New content for the note'),
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