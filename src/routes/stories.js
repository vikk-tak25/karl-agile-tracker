import { Router } from 'express';
import * as store from '../store.js';
import { validateStoryInput } from '../validation.js';
import { nowTimestamp } from '../util.js';

const router = Router();

/** Sort a list of stories by their priority (ascending). */
function sortByPriority(list) {
  return [...list].sort((a, b) => (a.priority || 0) - (b.priority || 0));
}

/** Next priority value for a story entering a given status column (appended last). */
function nextPriority(status) {
  return store
    .getAll()
    .filter((s) => s.status === status)
    .reduce((max, s) => Math.max(max, s.priority || 0), 0) + 1;
}

// GET /api/stories — all stories, ordered by priority.
router.get('/', (req, res) => {
  res.json(sortByPriority(store.getAll()));
});

// GET /api/stories/:id — a single story.
router.get('/:id', (req, res) => {
  const story = store.getById(req.params.id);
  if (!story) {
    return res.status(404).json({ error: 'Story ei leitud.' });
  }
  res.json(story);
});

// POST /api/stories — create a story.
router.post('/', (req, res) => {
  const { valid, errors, value } = validateStoryInput(req.body || {});
  if (!valid) {
    return res.status(400).json({ errors });
  }

  const timestamp = nowTimestamp();
  const story = {
    id: store.nextId(),
    ...value,
    priority: nextPriority(value.status),
    comments: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.insert(story);
  res.status(201).json(story);
});

// PUT /api/stories/:id — fully update a story.
router.put('/:id', (req, res) => {
  const existing = store.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Story ei leitud.' });
  }

  const { valid, errors, value } = validateStoryInput(req.body || {});
  if (!valid) {
    return res.status(400).json({ errors });
  }

  const updated = {
    ...existing,
    ...value,
    id: existing.id,
    comments: existing.comments,
    priority: existing.priority,
    createdAt: existing.createdAt,
    updatedAt: nowTimestamp(),
  };

  store.replace(existing.id, updated);
  res.json(updated);
});

// DELETE /api/stories/:id — remove a story.
router.delete('/:id', (req, res) => {
  const removed = store.remove(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'Story ei leitud.' });
  }
  res.status(204).end();
});

export default router;
