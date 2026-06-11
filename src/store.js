import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const seedFile = path.join(dataDir, 'seed.json');

// The runtime data file. Overridable via env var so tests can use a temp file
// without touching the real data.
const dataFile = process.env.AGILE_DATA_FILE || path.join(dataDir, 'stories.json');

// In-memory copy of the stories; the JSON file is the source of truth on disk.
let stories = [];

/** Write the current in-memory stories back to disk. */
function persist() {
  fs.writeFileSync(dataFile, JSON.stringify(stories, null, 2));
}

/**
 * Load stories from disk. On first run (no data file) the data is seeded from
 * data/seed.json and written out, so the board is never empty for a new user.
 */
export function load() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(dataFile)) {
    stories = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  } else {
    stories = fs.existsSync(seedFile)
      ? JSON.parse(fs.readFileSync(seedFile, 'utf-8'))
      : [];
    persist();
  }
  return stories;
}

/** All stories (a shallow copy so callers cannot mutate the store directly). */
export function getAll() {
  return stories.map((s) => ({ ...s }));
}

/** A single story by id, or null if not found. */
export function getById(id) {
  return stories.find((s) => s.id === Number(id)) || null;
}

/** Next free story id (max + 1). */
export function nextId() {
  return stories.reduce((max, s) => Math.max(max, s.id), 0) + 1;
}

/** Next free comment id within a given story. */
export function nextCommentId(story) {
  return (story.comments || []).reduce((max, c) => Math.max(max, c.id), 0) + 1;
}

/** Insert a new story and persist. */
export function insert(story) {
  stories.push(story);
  persist();
  return story;
}

/** Replace an existing story by id; returns the updated story or null. */
export function replace(id, updated) {
  const idx = stories.findIndex((s) => s.id === Number(id));
  if (idx === -1) return null;
  stories[idx] = updated;
  persist();
  return updated;
}

/** Remove a story by id; returns true if something was removed. */
export function remove(id) {
  const idx = stories.findIndex((s) => s.id === Number(id));
  if (idx === -1) return false;
  stories.splice(idx, 1);
  persist();
  return true;
}

/** Replace the whole collection (used by reorder) and persist. */
export function saveAll(next) {
  stories = next;
  persist();
  return getAll();
}

// Load once when the module is first imported.
load();
