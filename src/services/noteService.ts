/**
 * Service for handling NotePlan notes interactions
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface NotePath {
  type: 'calendar' | 'note';
  path: string;  // "/" for root, "02. Work" for subfolder, "02. Work/10. Tasks" for nested
}

interface Note {
  id: string;
  title: string;
  content: string;
  created: string;
  modified: string;
  location: NotePath;
  folder: string;  // Deprecated: for backward compatibility, use formatLocationString(location)
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

interface GetDailyNotesParams {
  start_date?: string; // YYYY-MM-DD format
  end_date?: string;   // YYYY-MM-DD format
  limit?: number;      // Maximum number of notes to return
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

/**
 * Helper Functions for NotePath
 */

/**
 * Create a NotePath object
 */
function createNotePath(type: 'calendar' | 'note', path: string): NotePath {
  return { type, path };
}

/**
 * Convert NotePath to filesystem path
 */
function getFileSystemPath(notePath: NotePath): string {
  const basePath = notePath.type === 'calendar' ? CALENDAR_PATH : NOTES_PATH;

  if (notePath.path === '/') {
    return basePath;
  }

  return path.join(basePath, notePath.path);
}

/**
 * Format NotePath as display string
 * Note: Calendar notes are not exposed via folder paths - they're accessed via dedicated tools
 */
function formatLocationString(notePath: NotePath): string {
  // Calendar notes return a special marker - users access them via get_todays_note or get_note_by_id
  if (notePath.type === 'calendar') {
    return '[daily-note]';
  }

  return notePath.path;
}

/**
 * Parse string to NotePath (for backward compatibility)
 * Note: Users should never specify "Calendar" - daily notes are accessed via dedicated tools
 */
function parseLocationString(str: string): NotePath {
  // Reject Calendar paths from user input - calendar notes are managed via dedicated tools
  if (str === 'Calendar' || str.startsWith('Calendar/') || str === '[daily-note]') {
    throw new Error('Cannot specify Calendar folder directly. Use create_daily_note, get_todays_note, or get_note_by_id with date format to work with daily notes.');
  }

  // Handle root path
  if (!str || str === '/' || str === '') {
    return createNotePath('note', '/');
  }

  // Handle note subfolders
  return createNotePath('note', str);
}

/**
 * Check if path is root
 */
function isRootPath(notePath: NotePath): boolean {
  return notePath.path === '/';
}

// Mock database for notes - fallback if NotePlan directory not found
const notesDb: Note[] = [
  {
    id: 'note1',
    title: 'Sample Note 1',
    content: 'This is a sample note',
    created: '2023-01-01T12:00:00Z',
    modified: '2023-01-02T14:30:00Z',
    location: createNotePath('note', '/'),
    folder: '/'
  },
  {
    id: 'note2',
    title: 'Sample Note 2',
    content: 'This is another sample note',
    created: '2023-02-15T09:45:00Z',
    modified: '2023-02-16T11:20:00Z',
    location: createNotePath('note', '/'),
    folder: '/'
  },
  {
    id: 'note3',
    title: 'Project Ideas',
    content: '- Build a note-taking app\n- Learn a new language\n- Write a book',
    created: '2023-03-10T16:15:00Z',
    modified: '2023-03-12T08:00:00Z',
    location: createNotePath('note', 'Projects'),
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
function parseNoteFile(filePath: string, location: NotePath): Note | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath);
    const filename = path.basename(filePath, ext);

    // Extract title from frontmatter or first heading or use filename
    const lines = content.split('\n');
    let title = filename;

    // First, check for YAML frontmatter (between --- markers)
    if (lines[0] === '---') {
      let inFrontmatter = true;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === '---') {
          inFrontmatter = false;
          break;
        }
        // Look for title field in frontmatter
        const match = lines[i].match(/^title:\s*(.+)$/);
        if (match) {
          title = match[1].trim();
          break;
        }
      }
    }

    // If no frontmatter title found, look for markdown-style title (# Title)
    if (title === filename) {
      for (const line of lines) {
        if (line.startsWith('# ') && line.length > 2) {
          title = line.substring(2).trim();
          break;
        }
      }
    }

    // Generate ID from filename
    const id = location.type === 'calendar' ? `calendar-${filename}` : `note-${filename}`;

    return {
      id,
      title,
      content,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      location,
      folder: formatLocationString(location),  // backward compatibility
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
function scanNotesDirectory(dirPath: string, location: NotePath): Note[] {
  const notes: Note[] = [];

  try {
    if (!fs.existsSync(dirPath)) {
      return notes;
    }

    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (item.isFile() && (item.name.endsWith('.md') || item.name.endsWith('.txt'))) {
        const filePath = path.join(dirPath, item.name);
        const note = parseNoteFile(filePath, location);
        if (note) {
          notes.push(note);
        }
      } else if (item.isDirectory() && !item.name.startsWith('.') && !item.name.startsWith('@')) {
        // Recursively scan subdirectories (but skip hidden and special folders)
        const subPath = location.path === '/' ? item.name : `${location.path}/${item.name}`;
        const subLocation = createNotePath(location.type, subPath);
        const subNotes = scanNotesDirectory(
          path.join(dirPath, item.name),
          subLocation
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
  const calendarLocation = createNotePath('calendar', '/');
  const calendarNotes = scanNotesDirectory(CALENDAR_PATH, calendarLocation);
  notes.push(...calendarNotes);

  // Load regular notes
  const notesLocation = createNotePath('note', '/');
  const regularNotes = scanNotesDirectory(NOTES_PATH, notesLocation);
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
 * Get note by exact title match
 */
function getNoteByTitle(title: string): Note | null {
  const notes = getAllNotes();
  return notes.find(note => note.title === title) || null;
}

/**
 * Extract note links from content and resolve them
 * Supports wiki-style links: [[Note Title]]
 */
function getLinkedNotes(noteId: string): { linkText: string; note: Note | null }[] {
  const sourceNote = getNoteById(noteId);
  if (!sourceNote) {
    throw new Error(`Note not found: ${noteId}`);
  }

  // Extract wiki-style links [[Title]]
  const wikiLinkPattern = /\[\[([^\]]+)\]\]/g;
  const links: { linkText: string; note: Note | null }[] = [];
  const matches = sourceNote.content.matchAll(wikiLinkPattern);

  for (const match of matches) {
    const linkText = match[1];
    const linkedNote = getNoteByTitle(linkText);
    links.push({ linkText, note: linkedNote });
  }

  return links;
}

/**
 * Get notes by folder
 * Note: Only works with regular notes (type='note'). Calendar notes are accessed via dedicated tools.
 */
function getNotesByFolder(folder: string): Note[] {
  const notes = getAllNotes();
  // Parse the folder string to NotePath for comparison
  // parseLocationString will reject "Calendar" and only return type='note' paths
  const targetLocation = parseLocationString(folder);

  return notes.filter(note => {
    // Only match notes of the same type (will always be 'note' since parseLocationString rejects 'calendar')
    if (note.location.type !== targetLocation.type) {
      return false;
    }

    // Exact match
    if (note.location.path === targetLocation.path) {
      return true;
    }

    // For root ("/"), match all regular notes recursively
    if (targetLocation.path === '/') {
      return true;
    }

    // For subfolders, check if note is in that folder or a subdirectory
    return note.location.path.startsWith(targetLocation.path + '/');
  });
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

  // Daily notes always go in Calendar with root path
  const location = createNotePath('calendar', '/');

  if (isNotePlanAvailable()) {
    // Write to actual NotePlan directory
    const filePath = path.join(CALENDAR_PATH, `${dateStr}.txt`);
    try {
      fs.writeFileSync(filePath, content, 'utf8');

      // Clear cache to force refresh
      notesCache = [];
      lastCacheUpdate = 0;

      // Return the newly created note
      return parseNoteFile(filePath, location)!;
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
      location,
      folder: formatLocationString(location),
      type: 'daily'
    };

    notesDb.push(newNote);
    return newNote;
  }
}

/**
 * Get all daily notes (calendar notes), optionally filtered by date range
 */
function getDailyNotes(params: GetDailyNotesParams = {}): Note[] {
  const notes = getAllNotes();
  let dailyNotes = notes.filter(note => note.location.type === 'calendar');

  // Sort by date (newest first by default)
  dailyNotes.sort((a, b) => {
    const dateA = a.filename || '';
    const dateB = b.filename || '';
    return dateB.localeCompare(dateA);
  });

  // Apply date filters if provided
  if (params.start_date) {
    const startDate = params.start_date.replace(/-/g, ''); // Convert YYYY-MM-DD to YYYYMMDD
    dailyNotes = dailyNotes.filter(note => (note.filename || '') >= startDate);
  }

  if (params.end_date) {
    const endDate = params.end_date.replace(/-/g, ''); // Convert YYYY-MM-DD to YYYYMMDD
    dailyNotes = dailyNotes.filter(note => (note.filename || '') <= endDate);
  }

  // Apply limit if provided
  if (params.limit && params.limit > 0) {
    dailyNotes = dailyNotes.slice(0, params.limit);
  }

  return dailyNotes;
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

  // Parse folder string to NotePath (always type='note')
  const location = parseLocationString(noteData.folder || '/');
  // Force type to be 'note' (can't create notes in calendar via this function)
  if (location.type !== 'note') {
    throw new Error('Cannot create regular notes in Calendar folder. Use createDailyNote instead.');
  }

  if (isNotePlanAvailable()) {
    // Get filesystem path for the location
    const targetPath = getFileSystemPath(location);

    // Create subfolder if it doesn't exist and not root
    if (location.path !== '/' && !fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    const filePath = path.join(targetPath, `${filename}.txt`);

    try {
      fs.writeFileSync(filePath, content, 'utf8');

      // Clear cache to force refresh
      notesCache = [];
      lastCacheUpdate = 0;

      // Return the newly created note
      return parseNoteFile(filePath, location)!;
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
      location,
      folder: formatLocationString(location)
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
      return parseNoteFile(existingNote.filePath, existingNote.location)!;
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

/**
 * Rename a note (changes title, filename, and updates markdown header)
 */
function renameNote(id: string, newTitle: string): Note {
  const existingNote = getNoteById(id);
  if (!existingNote) {
    throw new Error(`Note with id ${id} not found`);
  }

  // Don't allow renaming daily notes (calendar notes)
  if (existingNote.location.type === 'calendar' || id.startsWith('calendar-')) {
    throw new Error('Cannot rename daily notes. Daily notes use date-based filenames.');
  }

  if (!existingNote.filePath) {
    throw new Error('Cannot rename note: file path not available');
  }

  if (isNotePlanAvailable()) {
    try {
      // Generate new filename from title (sanitize for filesystem)
      const sanitizedTitle = newTitle
        .replace(/[^a-zA-Z0-9\s-_]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);

      const ext = path.extname(existingNote.filePath);
      const dirPath = path.dirname(existingNote.filePath);
      const newFilePath = path.join(dirPath, `${sanitizedTitle}${ext}`);

      // Check if new filename already exists
      if (fs.existsSync(newFilePath) && newFilePath !== existingNote.filePath) {
        throw new Error(`A note with the filename "${sanitizedTitle}${ext}" already exists in this folder`);
      }

      // Update content with new title in markdown header
      let content = existingNote.content;
      const lines = content.split('\n');
      let headerUpdated = false;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('# ')) {
          lines[i] = `# ${newTitle}`;
          headerUpdated = true;
          break;
        }
      }

      // If no header found, add one at the beginning
      if (!headerUpdated) {
        lines.unshift(`# ${newTitle}`, '');
      }

      content = lines.join('\n');

      // Write updated content to file
      fs.writeFileSync(existingNote.filePath, content, 'utf8');

      // Rename the file if filename is different
      if (newFilePath !== existingNote.filePath) {
        fs.renameSync(existingNote.filePath, newFilePath);
      }

      // Clear cache to force refresh
      notesCache = [];
      lastCacheUpdate = 0;

      // Return the renamed note
      return parseNoteFile(newFilePath, existingNote.location)!;
    } catch (error) {
      throw new Error(`Failed to rename note: ${(error as Error).message}`);
    }
  } else {
    // Fallback to mock database
    const noteIndex = notesDb.findIndex(note => note.id === id);
    if (noteIndex === -1) {
      throw new Error(`Note with id ${id} not found`);
    }

    const note = notesDb[noteIndex];
    const sanitizedTitle = newTitle
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);

    const newId = `note-${sanitizedTitle}`;
    const updatedNote: Note = {
      ...note,
      id: newId,
      title: newTitle,
      content: `# ${newTitle}\n\n${note.content.split('\n').slice(2).join('\n')}`,
      modified: new Date().toISOString()
    };

    notesDb[noteIndex] = updatedNote;
    return updatedNote;
  }
}

/**
 * Move a note to a different folder
 */
function moveNote(id: string, targetFolder: string): Note {
  const existingNote = getNoteById(id);
  if (!existingNote) {
    throw new Error(`Note with id ${id} not found`);
  }

  // Don't allow moving daily notes (calendar notes)
  if (existingNote.location.type === 'calendar' || id.startsWith('calendar-')) {
    throw new Error('Cannot move daily notes. Daily notes must remain in the Calendar folder.');
  }

  if (!existingNote.filePath) {
    throw new Error('Cannot move note: file path not available');
  }

  // Parse target folder to NotePath
  const targetLocation = parseLocationString(targetFolder);

  // Ensure we're moving to a note folder, not calendar
  if (targetLocation.type !== 'note') {
    throw new Error('Cannot move notes to Calendar folder. Only daily notes belong in Calendar.');
  }

  if (isNotePlanAvailable()) {
    try {
      // Get filesystem path for target location
      const targetPath = getFileSystemPath(targetLocation);

      // Create target folder if it doesn't exist and not root
      if (targetLocation.path !== '/' && !fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      const filename = path.basename(existingNote.filePath);
      const newFilePath = path.join(targetPath, filename);

      // Check if file already exists at target location
      if (fs.existsSync(newFilePath) && newFilePath !== existingNote.filePath) {
        throw new Error(`A note with the filename "${filename}" already exists in the target folder`);
      }

      // Move the file
      if (newFilePath !== existingNote.filePath) {
        fs.renameSync(existingNote.filePath, newFilePath);
      }

      // Clear cache to force refresh
      notesCache = [];
      lastCacheUpdate = 0;

      // Return the moved note
      return parseNoteFile(newFilePath, targetLocation)!;
    } catch (error) {
      throw new Error(`Failed to move note: ${(error as Error).message}`);
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
      location: targetLocation,
      folder: formatLocationString(targetLocation),
      modified: new Date().toISOString()
    };

    notesDb[noteIndex] = updatedNote;
    return updatedNote;
  }
}

/**
 * Rename a folder
 */
function renameFolder(oldFolderPath: string, newFolderName: string): { success: boolean; affectedNotes: number; message: string } {
  // Parse old folder path to NotePath
  const oldLocation = parseLocationString(oldFolderPath);

  // Cannot rename Calendar folder
  if (oldLocation.type === 'calendar') {
    throw new Error('Cannot rename Calendar folder. Calendar is a system folder for daily notes.');
  }

  // Cannot rename root folder
  if (oldLocation.path === '/') {
    throw new Error('Cannot rename root folder.');
  }

  // Validate new folder name (no slashes, no special characters)
  const sanitizedNewName = newFolderName.trim();
  if (!sanitizedNewName) {
    throw new Error('New folder name cannot be empty.');
  }

  if (sanitizedNewName.includes('/')) {
    throw new Error('Folder name cannot contain slashes. To move to a different parent folder, use move operations on individual notes.');
  }

  if (sanitizedNewName === 'Calendar') {
    throw new Error('Cannot use "Calendar" as folder name. This is reserved for daily notes.');
  }

  // Calculate new path
  const pathParts = oldLocation.path.split('/');
  pathParts[pathParts.length - 1] = sanitizedNewName;
  const newPath = pathParts.join('/');

  const newLocation = createNotePath('note', newPath);

  if (!isNotePlanAvailable()) {
    // Fallback to mock database
    const affectedNotes = notesDb.filter(note =>
      note.location.type === 'note' &&
      (note.location.path === oldLocation.path || note.location.path.startsWith(oldLocation.path + '/'))
    );

    // Update all affected notes
    affectedNotes.forEach(note => {
      const noteIndex = notesDb.findIndex(n => n.id === note.id);
      if (noteIndex !== -1) {
        let updatedPath: string;
        if (note.location.path === oldLocation.path) {
          updatedPath = newPath;
        } else {
          // Update subfolders
          updatedPath = note.location.path.replace(oldLocation.path + '/', newPath + '/');
        }

        const updatedLocation = createNotePath('note', updatedPath);
        notesDb[noteIndex] = {
          ...note,
          location: updatedLocation,
          folder: formatLocationString(updatedLocation),
          modified: new Date().toISOString()
        };
      }
    });

    return {
      success: true,
      affectedNotes: affectedNotes.length,
      message: `Folder renamed from "${oldLocation.path}" to "${newPath}". ${affectedNotes.length} note(s) updated.`
    };
  }

  // Real filesystem operations
  try {
    const oldFolderFsPath = getFileSystemPath(oldLocation);
    const newFolderFsPath = getFileSystemPath(newLocation);

    // Check if old folder exists
    if (!fs.existsSync(oldFolderFsPath)) {
      throw new Error(`Folder "${oldLocation.path}" does not exist.`);
    }

    // Check if it's actually a directory
    if (!fs.statSync(oldFolderFsPath).isDirectory()) {
      throw new Error(`"${oldLocation.path}" is not a folder.`);
    }

    // Check if new folder name already exists
    if (fs.existsSync(newFolderFsPath)) {
      throw new Error(`A folder named "${newPath}" already exists.`);
    }

    // Count affected notes before renaming
    const allNotes = getAllNotes();
    const affectedNotes = allNotes.filter(note =>
      note.location.type === 'note' &&
      (note.location.path === oldLocation.path || note.location.path.startsWith(oldLocation.path + '/'))
    );

    // Rename the folder
    fs.renameSync(oldFolderFsPath, newFolderFsPath);

    // Clear cache to force refresh (all notes will be re-scanned with new paths)
    notesCache = [];
    lastCacheUpdate = 0;

    return {
      success: true,
      affectedNotes: affectedNotes.length,
      message: `Folder renamed from "${oldLocation.path}" to "${newPath}". ${affectedNotes.length} note(s) updated.`
    };
  } catch (error) {
    throw new Error(`Failed to rename folder: ${(error as Error).message}`);
  }
}

/**
 * Create a new folder
 */
function createFolder(folderPath: string): { success: boolean; message: string; path: string } {
  // Parse folder path to NotePath
  const location = parseLocationString(folderPath);

  // Cannot create Calendar folder
  if (location.type === 'calendar') {
    throw new Error('Cannot create Calendar folder. Calendar is a system folder for daily notes.');
  }

  // Cannot create root folder (already exists)
  if (location.path === '/') {
    throw new Error('Root folder already exists. Please specify a subfolder path.');
  }

  if (!isNotePlanAvailable()) {
    // In mock mode, just return success
    return {
      success: true,
      message: `Folder "${location.path}" created (mock mode).`,
      path: location.path
    };
  }

  try {
    const folderFsPath = getFileSystemPath(location);

    // Check if folder already exists
    if (fs.existsSync(folderFsPath)) {
      throw new Error(`Folder "${location.path}" already exists.`);
    }

    // Create the folder (and parent folders if needed)
    fs.mkdirSync(folderFsPath, { recursive: true });

    return {
      success: true,
      message: `Folder "${location.path}" created successfully.`,
      path: location.path
    };
  } catch (error) {
    throw new Error(`Failed to create folder: ${(error as Error).message}`);
  }
}

export const noteService = {
  getAllNotes,
  getNoteById,
  getNoteByTitle,
  searchNotes,
  getLinkedNotes,
  getNotesByFolder,
  createDailyNote,
  getDailyNotes,
  createNote,
  updateNote,
  editNote,
  renameNote,
  moveNote,
  renameFolder,
  createFolder
};