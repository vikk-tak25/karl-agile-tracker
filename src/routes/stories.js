import { Router } from 'express';
import * as store from '../store.js';
import { validateStoryInput, STATUSES } from '../validation.js';
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

// PATCH /api/stories/:id/status — change only the status (move between columns).
router.patch('/:id/status', (req, res) => {
  const existing = store.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Story ei leitud.' });
  }

  const { status } = req.body || {};
  if (!STATUSES.includes(status)) {
    return res.status(400).json({
      errors: [`Staatus peab olema üks järgmistest: ${STATUSES.join(', ')}.`],
    });
  }

  const updated = {
    ...existing,
    status,
    // When the column changes, append to the end of the target column.
    priority: status === existing.status ? existing.priority : nextPriority(status),
    updatedAt: nowTimestamp(),
  };

  store.replace(existing.id, updated);
  res.json(updated);
});

// PATCH /api/stories/reorder — persist a new ordering (backlog prioritisation).
// Body: { "order": [id, id, ...] }. Each listed story gets priority = position.
router.patch('/reorder', (req, res) => {
  const order = (req.body || {}).order;
  if (!Array.isArray(order)) {
    return res.status(400).json({ errors: ['Väli "order" peab olema massiiv id-dest.'] });
  }

  const all = store.getAll();
  order.forEach((id, index) => {
    const story = all.find((s) => s.id === Number(id));
    if (story) {
      story.priority = index + 1;
    }
  });

  store.saveAll(all);
  res.json(sortByPriority(all));
});

// POST /api/stories/:id/comments — add a comment (with timestamp) to a story.
router.post('/:id/comments', (req, res) => {
  const story = store.getById(req.params.id);
  if (!story) {
    return res.status(404).json({ error: 'Story ei leitud.' });
  }

  const text = typeof (req.body || {}).text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    return res.status(400).json({ errors: ['Kommentaar ei tohi olla tühi.'] });
  }

  const comment = {
    id: store.nextCommentId(story),
    text,
    createdAt: nowTimestamp(),
  };

  const updated = {
    ...story,
    comments: [...(story.comments || []), comment],
    updatedAt: nowTimestamp(),
  };

  store.replace(story.id, updated);
  res.status(201).json(updated);
});

export default router;
