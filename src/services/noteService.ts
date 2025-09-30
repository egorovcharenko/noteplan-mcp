/**
 * Service for handling NotePlan notes interactions
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface Note {
  id: string;
  title: string;
  content: string;
  created: string;
  modified: string;
  folder: string;
  filePath?: string;
  filename?: string;
  type?: string;
}

interface CreateNoteParams {
  title: string;
  content?: string;
  folder?: string;
}

interface CreateDailyNoteParams {
  date?: string;
  content?: string;
}

interface UpdateNoteParams {
  title?: string;
  content?: string;
  folder?: string;
}

interface EditNoteParams {
  old_text: string;
  new_text: string;
  replace_all?: boolean;
}

// NotePlan data directory path
const NOTEPLAN_BASE_PATH = path.join(
  os.homedir(), 
  'Library/Containers/co.noteplan.NotePlan3/Data/Library/Application Support/co.noteplan.NotePlan3'
);
const CALENDAR_PATH = path.join(NOTEPLAN_BASE_PATH, 'Calendar');
const NOTES_PATH = path.join(NOTEPLAN_BASE_PATH, 'Notes');

// Cache for notes data
let notesCache: Note[] = [];
let lastCacheUpdate: number = 0;
const CACHE_DURATION = 5000; // 5 seconds

// Mock database for notes - fallback if NotePlan directory not found
const notesDb: Note[] = [
  { 
    id: 'note1', 
    title: 'Sample Note 1', 
    content: 'This is a sample note',
    created: '2023-01-01T12:00:00Z',
    modified: '2023-01-02T14:30:00Z',
    folder: 'Notes'
  },
  { 
    id: 'note2', 
    title: 'Sample Note 2', 
    content: 'This is another sample note',
    created: '2023-02-15T09:45:00Z',
    modified: '2023-02-16T11:20:00Z',
    folder: 'Notes'
  },
  { 
    id: 'note3', 
    title: 'Project Ideas', 
    content: '- Build a note-taking app\n- Learn a new language\n- Write a book',
    created: '2023-03-10T16:15:00Z',
    modified: '2023-03-12T08:00:00Z',
    folder: 'Projects'
  }
];

/**
 * Check if NotePlan directory exists
 */
function isNotePlanAvailable(): boolean {
  try {
    return fs.existsSync(NOTEPLAN_BASE_PATH) && 
           fs.existsSync(CALENDAR_PATH) && 
           fs.existsSync(NOTES_PATH);
  } catch (error) {
    return false;
  }
}

/**
 * Parse note file (markdown or text) to extract metadata
 */
function parseNoteFile(filePath: string, folder: string): Note | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath);
    const filename = path.basename(filePath, ext);
    
    // Extract title from first line or use filename
    const lines = content.split('\n');
    let title = filename;
    
    // Look for markdown-style title (# Title)
    for (const line of lines) {
      if (line.startsWith('# ') && line.length > 2) {
        title = line.substring(2).trim();
        break;
      }
    }
    
    // Generate ID from filename
    const id = folder === 'Calendar' ? `calendar-${filename}` : `note-${filename}`;
    
    return {
      id,
      title,
      content,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      folder,
      filePath,
      filename
    };
  } catch (error) {
    console.error(`Error parsing file ${filePath}:`, error);
    return null;
  }
}

/**
 * Scan directory for note files (.md and .txt)
 */
function scanNotesDirectory(dirPath: string, folder: string): Note[] {
  const notes: Note[] = [];
  
  try {
    if (!fs.existsSync(dirPath)) {
      return notes;
    }
    
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isFile() && (item.name.endsWith('.md') || item.name.endsWith('.txt'))) {
        const filePath = path.join(dirPath, item.name);
        const note = parseNoteFile(filePath, folder);
        if (note) {
          notes.push(note);
        }
      } else if (item.isDirectory() && !item.name.startsWith('.') && !item.name.startsWith('@')) {
        // Recursively scan subdirectories (but skip hidden and special folders)
        const subNotes = scanNotesDirectory(
          path.join(dirPath, item.name), 
          `${folder}/${item.name}`
        );
        notes.push(...subNotes);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
  
  return notes;
}

/**
 * Load all notes from NotePlan directories
 */
function loadNotesFromFileSystem(): Note[] {
  if (!isNotePlanAvailable()) {
    console.warn('NotePlan directory not found, using mock data');
    return notesDb;
  }
  
  const notes: Note[] = [];
  
  // Load calendar notes
  const calendarNotes = scanNotesDirectory(CALENDAR_PATH, 'Calendar');
  notes.push(...calendarNotes);
  
  // Load regular notes
  const regularNotes = scanNotesDirectory(NOTES_PATH, 'Notes');
  notes.push(...regularNotes);
  
  return notes.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
}

/**
 * Get all notes with caching
 */
function getAllNotes(): Note[] {
  const now = Date.now();
  
  // Use cache if still valid
  if (notesCache.length > 0 && (now - lastCacheUpdate) < CACHE_DURATION) {
    return notesCache;
  }
  
  // Refresh cache
  notesCache = loadNotesFromFileSystem();
  lastCacheUpdate = now;
  
  return notesCache;
}

/**
 * Get a note by ID
 */
function getNoteById(id: string): Note | null {
  const notes = getAllNotes();
  
  // Try exact match first
  let note = notes.find(note => note.id === id);
  if (note) return note;
  
  // Try with calendar prefix for date-like IDs
  if (/^\d{8}$/.test(id)) {
    // If it's an 8-digit date (YYYYMMDD), try with calendar prefix
    note = notes.find(note => note.id === `calendar-${id}`);
    if (note) return note;
  }
  
  // Try converting dash format to no-dash format for calendar notes
  if (/^\d{4}-\d{2}-\d{2}$/.test(id)) {
    // Convert YYYY-MM-DD to YYYYMMDD and try with calendar prefix
    const dateStr = id.replace(/-/g, '');
    note = notes.find(note => note.id === `calendar-${dateStr}`);
    if (note) return note;
  }
  
  return null;
}

/**
 * Search notes by title or content
 */
function searchNotes(query: string): Note[] {
  const notes = getAllNotes();
  const lowerQuery = query.toLowerCase();
  return notes.filter(note => 
    note.title.toLowerCase().includes(lowerQuery) || 
    note.content.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get notes by folder
 */
function getNotesByFolder(folder: string): Note[] {
  const notes = getAllNotes();
  return notes.filter(note => note.folder === folder || note.folder.startsWith(folder + '/'));
}

/**
 * Create a daily note with today's date
 */
function createDailyNote(options: CreateDailyNoteParams = {}): Note {
  const noteDate = options.date ? new Date(options.date) : new Date();
  const dateStr = noteDate.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format
  const noteId = `calendar-${dateStr}`;
  
  // Check if daily note already exists
  const existingNote = getNoteById(noteId);
  if (existingNote) {
    throw new Error(`Daily note for ${dateStr} already exists`);
  }
  
  const defaultTemplate = `# ${dateStr}

## Today's Plan
- [ ] 

## Notes


## Reflection


---
Created: ${noteDate.toISOString()}`;
  
  const content = options.content || defaultTemplate;
  
  if (isNotePlanAvailable()) {
    // Write to actual NotePlan directory
    const filePath = path.join(CALENDAR_PATH, `${dateStr}.txt`);
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      
      // Clear cache to force refresh
      notesCache = [];
      lastCacheUpdate = 0;
      
      // Return the newly created note
      return parseNoteFile(filePath, 'Calendar')!;
    } catch (error) {
      throw new Error(`Failed to create daily note: ${(error as Error).message}`);
    }
  } else {
    // Fallback to mock database
    const newNote: Note = {
      id: noteId,
      title: `Daily Note - ${dateStr}`,
      content,
      created: noteDate.toISOString(),
      modified: noteDate.toISOString(),
      folder: 'Calendar',
      type: 'daily'
    };
    
    notesDb.push(newNote);
    return newNote;
  }
}

/**
 * Create a new note
 */
function createNote(noteData: CreateNoteParams): Note {
  if (!noteData.title) {
    throw new Error('Note title is required');
  }
  
  const now = new Date();
  const timestamp = now.toISOString();
  
  // Generate filename from title (sanitize for filesystem)
  const sanitizedTitle = noteData.title
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  
  const filename = `${sanitizedTitle}-${Date.now()}`;
  const noteId = `note-${filename}`;
  
  // Prepare content with title as markdown-style header
  const content = noteData.content ? 
    `# ${noteData.title}\n\n${noteData.content}` : 
    `# ${noteData.title}\n\n`;
  
  if (isNotePlanAvailable()) {
    // Determine target directory
    const targetFolder = noteData.folder || 'Notes';
    let targetPath = NOTES_PATH;
    
    if (targetFolder !== 'Notes' && targetFolder !== 'Calendar') {
      targetPath = path.join(NOTES_PATH, targetFolder);
      
      // Create subfolder if it doesn't exist
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
    }
    
    const filePath = path.join(targetPath, `${filename}.txt`);
    
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      
      // Clear cache to force refresh
      notesCache = [];
      lastCacheUpdate = 0;
      
      // Return the newly created note
      return parseNoteFile(filePath, targetFolder)!;
    } catch (error) {
      throw new Error(`Failed to create note: ${(error as Error).message}`);
    }
  } else {
    // Fallback to mock database
    const newNote: Note = {
      id: noteId,
      title: noteData.title,
      content,
      created: timestamp,
      modified: timestamp,
      folder: noteData.folder || 'Notes'
    };
    
    notesDb.push(newNote);
    return newNote;
  }
}

/**
 * Update an existing note
 */
function updateNote(id: string, updates: UpdateNoteParams): Note {
  const existingNote = getNoteById(id);
  if (!existingNote) {
    throw new Error(`Note with id ${id} not found`);
  }
  
  if (isNotePlanAvailable() && existingNote.filePath) {
    try {
      // Update the file content
      let newContent = existingNote.content;
      
      if (updates.content !== undefined) {
        newContent = updates.content;
      }
      
      // If title is being updated, update the first markdown-style header
      if (updates.title !== undefined) {
        const lines = newContent.split('\n');
        let headerUpdated = false;
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('# ')) {
            lines[i] = `# ${updates.title}`;
            headerUpdated = true;
            break;
          }
        }
        
        // If no header found, add one at the beginning
        if (!headerUpdated) {
          lines.unshift(`# ${updates.title}`, '');
        }
        
        newContent = lines.join('\n');
      }
      
      // Write updated content to file
      fs.writeFileSync(existingNote.filePath, newContent, 'utf8');
      
      // Clear cache to force refresh
      notesCache = [];
      lastCacheUpdate = 0;
      
      // Return updated note
      return parseNoteFile(existingNote.filePath, existingNote.folder)!;
    } catch (error) {
      throw new Error(`Failed to update note: ${(error as Error).message}`);
    }
  } else {
    // Fallback to mock database
    const noteIndex = notesDb.findIndex(note => note.id === id);
    if (noteIndex === -1) {
      throw new Error(`Note with id ${id} not found`);
    }
    
    const note = notesDb[noteIndex];
    const updatedNote: Note = {
      ...note,
      ...updates,
      modified: new Date().toISOString()
    };
    
    notesDb[noteIndex] = updatedNote;
    return updatedNote;
  }
}

/**
 * Edit note by replacing text (similar to Edit tool in Claude Code)
 */
function editNote(id: string, params: EditNoteParams): Note {
  const existingNote = getNoteById(id);
  if (!existingNote) {
    throw new Error(`Note with id ${id} not found`);
  }

  const { old_text, new_text, replace_all = false } = params;

  // Get current content
  let content = existingNote.content;

  // Check how many occurrences exist
  const occurrences = (content.match(new RegExp(old_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

  if (occurrences === 0) {
    throw new Error(`Text not found in note: "${old_text}"`);
  }

  if (occurrences > 1 && !replace_all) {
    throw new Error(`Found ${occurrences} occurrences of the text. Set replace_all=true to replace all, or provide more specific text to match exactly one occurrence.`);
  }

  // Perform replacement
  if (replace_all) {
    content = content.replaceAll(old_text, new_text);
  } else {
    content = content.replace(old_text, new_text);
  }

  // Update the note with new content
  return updateNote(id, { content });
}

export const noteService = {
  getAllNotes,
  getNoteById,
  searchNotes,
  getNotesByFolder,
  createDailyNote,
  createNote,
  updateNote,
  editNote
};