/**
 * Service for handling NotePlan notes interactions
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// NotePlan data directory path
const NOTEPLAN_BASE_PATH = path.join(
  os.homedir(), 
  'Library/Containers/co.noteplan.NotePlan3/Data/Library/Application Support/co.noteplan.NotePlan3'
);
const CALENDAR_PATH = path.join(NOTEPLAN_BASE_PATH, 'Calendar');
const NOTES_PATH = path.join(NOTEPLAN_BASE_PATH, 'Notes');

// Cache for notes data
let notesCache = [];
let lastCacheUpdate = 0;
const CACHE_DURATION = 5000; // 5 seconds

// Mock database for notes - fallback if NotePlan directory not found
const notesDb = [
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
 * @returns {boolean} True if NotePlan directory exists
 */
function isNotePlanAvailable() {
  try {
    return fs.existsSync(NOTEPLAN_BASE_PATH) && 
           fs.existsSync(CALENDAR_PATH) && 
           fs.existsSync(NOTES_PATH);
  } catch (error) {
    return false;
  }
}

/**
 * Parse markdown file to extract metadata
 * @param {string} filePath - Path to the markdown file
 * @param {string} folder - Folder type (Calendar/Notes)
 * @returns {Object} Note object
 */
function parseMarkdownFile(filePath, folder) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    const filename = path.basename(filePath, '.md');
    
    // Extract title from first line or use filename
    const lines = content.split('\n');
    let title = filename;
    
    // Look for markdown title (# Title)
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
 * Scan directory for markdown files
 * @param {string} dirPath - Directory path to scan
 * @param {string} folder - Folder type
 * @returns {Array} Array of note objects
 */
function scanNotesDirectory(dirPath, folder) {
  const notes = [];
  
  try {
    if (!fs.existsSync(dirPath)) {
      return notes;
    }
    
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isFile() && item.name.endsWith('.md')) {
        const filePath = path.join(dirPath, item.name);
        const note = parseMarkdownFile(filePath, folder);
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
 * @returns {Array} List of notes
 */
function loadNotesFromFileSystem() {
  if (!isNotePlanAvailable()) {
    console.warn('NotePlan directory not found, using mock data');
    return notesDb;
  }
  
  const notes = [];
  
  // Load calendar notes
  const calendarNotes = scanNotesDirectory(CALENDAR_PATH, 'Calendar');
  notes.push(...calendarNotes);
  
  // Load regular notes
  const regularNotes = scanNotesDirectory(NOTES_PATH, 'Notes');
  notes.push(...regularNotes);
  
  return notes.sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

/**
 * Get all notes with caching
 * @returns {Array} List of notes
 */
function getAllNotes() {
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
 * @param {string} id - Note ID
 * @returns {Object|null} Note object or null if not found
 */
function getNoteById(id) {
  const notes = getAllNotes();
  return notes.find(note => note.id === id) || null;
}

/**
 * Search notes by title or content
 * @param {string} query - Search query
 * @returns {Array} List of matching notes
 */
function searchNotes(query) {
  const notes = getAllNotes();
  const lowerQuery = query.toLowerCase();
  return notes.filter(note => 
    note.title.toLowerCase().includes(lowerQuery) || 
    note.content.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get notes by folder
 * @param {string} folder - Folder name
 * @returns {Array} List of notes in the folder
 */
function getNotesByFolder(folder) {
  const notes = getAllNotes();
  return notes.filter(note => note.folder === folder || note.folder.startsWith(folder + '/'));
}

/**
 * Create a daily note with today's date
 * @param {Object} options - Options for daily note creation
 * @param {string} options.template - Template content for the daily note
 * @returns {Object} Created note object
 */
function createDailyNote(options = {}) {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format
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
Created: ${today.toISOString()}`;
  
  const content = options.template || defaultTemplate;
  
  if (isNotePlanAvailable()) {
    // Write to actual NotePlan directory
    const filePath = path.join(CALENDAR_PATH, `${dateStr}.md`);
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      
      // Clear cache to force refresh
      notesCache = [];
      lastCacheUpdate = 0;
      
      // Return the newly created note
      return parseMarkdownFile(filePath, 'Calendar');
    } catch (error) {
      throw new Error(`Failed to create daily note: ${error.message}`);
    }
  } else {
    // Fallback to mock database
    const newNote = {
      id: noteId,
      title: `Daily Note - ${dateStr}`,
      content,
      created: today.toISOString(),
      modified: today.toISOString(),
      folder: 'Calendar',
      type: 'daily'
    };
    
    notesDb.push(newNote);
    return newNote;
  }
}

/**
 * Create a new note
 * @param {Object} noteData - Note data
 * @param {string} noteData.title - Note title
 * @param {string} noteData.content - Note content
 * @param {string} noteData.folder - Note folder (default: 'Notes')
 * @returns {Object} Created note object
 */
function createNote(noteData) {
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
  
  // Prepare content with title as markdown header
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
    
    const filePath = path.join(targetPath, `${filename}.md`);
    
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      
      // Clear cache to force refresh
      notesCache = [];
      lastCacheUpdate = 0;
      
      // Return the newly created note
      return parseMarkdownFile(filePath, targetFolder);
    } catch (error) {
      throw new Error(`Failed to create note: ${error.message}`);
    }
  } else {
    // Fallback to mock database
    const newNote = {
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
 * @param {string} id - Note ID
 * @param {Object} updates - Updates to apply
 * @param {string} updates.title - New title
 * @param {string} updates.content - New content
 * @param {string} updates.folder - New folder
 * @returns {Object} Updated note object
 */
function updateNote(id, updates) {
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
      
      // If title is being updated, update the first markdown header
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
      return parseMarkdownFile(existingNote.filePath, existingNote.folder);
    } catch (error) {
      throw new Error(`Failed to update note: ${error.message}`);
    }
  } else {
    // Fallback to mock database
    const noteIndex = notesDb.findIndex(note => note.id === id);
    if (noteIndex === -1) {
      throw new Error(`Note with id ${id} not found`);
    }
    
    const note = notesDb[noteIndex];
    const updatedNote = {
      ...note,
      ...updates,
      modified: new Date().toISOString()
    };
    
    notesDb[noteIndex] = updatedNote;
    return updatedNote;
  }
}

module.exports = {
  getAllNotes,
  getNoteById,
  searchNotes,
  getNotesByFolder,
  createDailyNote,
  createNote,
  updateNote
};