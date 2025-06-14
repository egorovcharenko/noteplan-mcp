#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const noteService = require('./services/noteService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'noteplan-mcp' });
});

// MCP protocol routes
app.post('/mcp/v1/command', (req, res) => {
  const { command, args = {} } = req.body;
  
  console.log(`Received command: ${command}`, args);
  
  // Process the command
  switch (command) {
  case 'ping':
    return res.json({ result: 'pong', status: 'success' });
    
  case 'getNotes':
    return res.json({ 
      result: noteService.getAllNotes(),
      status: 'success' 
    });
    
  case 'getNoteById': {
    if (!args.id) {
      return res.status(400).json({ 
        error: 'Missing required parameter: id', 
        status: 'error' 
      });
    }
      
    const note = noteService.getNoteById(args.id);
    if (!note) {
      return res.status(404).json({ 
        error: `Note not found with id: ${args.id}`, 
        status: 'error' 
      });
    }
      
    return res.json({ result: note, status: 'success' });
  }
    
  case 'searchNotes':
    if (!args.query) {
      return res.status(400).json({ 
        error: 'Missing required parameter: query', 
        status: 'error' 
      });
    }
      
    return res.json({ 
      result: noteService.searchNotes(args.query),
      status: 'success' 
    });
    
  case 'getNotesByFolder':
    if (!args.folder) {
      return res.status(400).json({ 
        error: 'Missing required parameter: folder', 
        status: 'error' 
      });
    }
      
    return res.json({ 
      result: noteService.getNotesByFolder(args.folder),
      status: 'success' 
    });
    
  case 'createDailyNote':
    try {
      const dailyNote = noteService.createDailyNote(args);
      return res.json({ 
        result: dailyNote, 
        status: 'success' 
      });
    } catch (error) {
      return res.status(400).json({ 
        error: error.message, 
        status: 'error' 
      });
    }
    
  case 'createNote':
    try {
      if (!args.title) {
        return res.status(400).json({ 
          error: 'Missing required parameter: title', 
          status: 'error' 
        });
      }
        
      const newNote = noteService.createNote(args);
      return res.json({ 
        result: newNote, 
        status: 'success' 
      });
    } catch (error) {
      return res.status(400).json({ 
        error: error.message, 
        status: 'error' 
      });
    }
    
  case 'updateNote':
    try {
      if (!args.id) {
        return res.status(400).json({ 
          error: 'Missing required parameter: id', 
          status: 'error' 
        });
      }
        
      const { id, ...updates } = args;
      const updatedNote = noteService.updateNote(id, updates);
      return res.json({ 
        result: updatedNote, 
        status: 'success' 
      });
    } catch (error) {
      return res.status(404).json({ 
        error: error.message, 
        status: 'error' 
      });
    }
    
  default:
    return res.status(400).json({ 
      error: `Unknown command: ${command}`, 
      status: 'error' 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`NotePlan MCP server running on port ${PORT}`);
});