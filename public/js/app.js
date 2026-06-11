import { api } from './api.js';

const COLUMNS = ['todo', 'doing', 'done'];

// Application state. `stories` is the latest snapshot from the server.
const state = {
  stories: [],
};

/** Fetch all stories from the API and re-render the board. */
async function load() {
  state.stories = await api.getStories();
  render();
}

/** Render every column from the current state. */
function render() {
  for (const status of COLUMNS) {
    const list = document.querySelector(`[data-list="${status}"]`);
    const inColumn = state.stories.filter((s) => s.status === status);

    list.innerHTML = '';
    if (inColumn.length === 0) {
      const hint = document.createElement('p');
      hint.className = 'empty-hint';
      hint.textContent = 'Lugusid pole';
      list.appendChild(hint);
    } else {
      for (const story of inColumn) {
        list.appendChild(renderCard(story));
      }
    }

    updateColumnMeta(status, inColumn);
  }
}

/** Build a single story card element. */
function renderCard(story) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = story.id;
  card.innerHTML = `
    <h3 class="card-title">${escapeHtml(story.title)}</h3>
    <div class="card-footer">
      <span class="badge points">${Number(story.points)} p</span>
      <span class="badge status-${story.status}">${story.status}</span>
    </div>`;
  return card;
}

/** Update a column's story count and total points (points sum per column). */
function updateColumnMeta(status, inColumn) {
  const column = document.querySelector(`.column[data-status="${status}"]`);
  const points = inColumn.reduce((sum, s) => sum + (Number(s.points) || 0), 0);
  column.querySelector('[data-count]').textContent = inColumn.length;
  column.querySelector('[data-points]').textContent = points;
}

/** Escape user-provided text before inserting it into innerHTML. */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

load();
