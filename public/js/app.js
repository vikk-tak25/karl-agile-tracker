import { api, ApiError } from './api.js';

const COLUMNS = ['todo', 'doing', 'done'];

// Application state. `stories` is the latest snapshot from the server;
// `editingId` is the id of the story currently being edited (null = create).
const state = {
  stories: [],
  editingId: null,
};

// --- DOM references -------------------------------------------------------
const dialog = document.getElementById('story-dialog');
const form = document.getElementById('story-form');
const formTitle = document.getElementById('story-form-title');
const criteriaList = document.getElementById('criteria-list');
const formErrors = document.getElementById('form-errors');

// --- Data loading & rendering --------------------------------------------

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
      <span class="card-actions">
        <button type="button" class="icon-btn" data-action="edit" title="Muuda">✎</button>
        <button type="button" class="icon-btn" data-action="delete" title="Kustuta">🗑</button>
      </span>
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

// --- Story dialog (create) -----------------------------------------------

/** Append one acceptance-criterion input row to the dialog. */
function addCriterionRow(value = '') {
  const row = document.createElement('div');
  row.className = 'criterion';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.placeholder = 'nt. Kasutaja saab sisestada pealkirja';

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'icon-btn';
  remove.textContent = '✕';
  remove.title = 'Eemalda tingimus';
  remove.addEventListener('click', () => row.remove());

  row.append(input, remove);
  criteriaList.appendChild(row);
}

function hideErrors() {
  formErrors.hidden = true;
  formErrors.innerHTML = '';
}

function showErrors(errors) {
  formErrors.innerHTML = '';
  for (const err of errors) {
    const li = document.createElement('li');
    li.textContent = err;
    formErrors.appendChild(li);
  }
  formErrors.hidden = errors.length === 0;
}

/** Open the dialog in "create" mode with one empty criterion row. */
function openCreateDialog() {
  form.reset();
  state.editingId = null;
  formTitle.textContent = 'Uus story';
  criteriaList.innerHTML = '';
  addCriterionRow();
  hideErrors();
  dialog.showModal();
}

/** Open the dialog in "edit" mode, pre-filled from an existing story. */
function openEditDialog(story) {
  form.reset();
  state.editingId = story.id;
  formTitle.textContent = 'Muuda story';
  form.elements.title.value = story.title;
  form.elements.description.value = story.description || '';
  form.elements.points.value = story.points;
  form.elements.status.value = story.status;
  criteriaList.innerHTML = '';
  (story.acceptanceCriteria || []).forEach((c) => addCriterionRow(c));
  if (!criteriaList.children.length) addCriterionRow();
  hideErrors();
  dialog.showModal();
}

/** Confirm and delete a story. */
async function deleteStory(story) {
  if (!confirm(`Kustutan story "${story.title}"?`)) return;
  await api.deleteStory(story.id);
  await load();
}

/** Read the form into a story payload for the API. */
function collectFormData() {
  const data = new FormData(form);
  const acceptanceCriteria = [...criteriaList.querySelectorAll('input')]
    .map((i) => i.value.trim())
    .filter(Boolean);
  return {
    title: (data.get('title') || '').trim(),
    description: (data.get('description') || '').trim(),
    points: data.get('points'),
    status: data.get('status'),
    acceptanceCriteria,
  };
}

/** Submit handler — create or update depending on state.editingId. */
async function handleSubmit(event) {
  event.preventDefault();
  hideErrors();
  const payload = collectFormData();

  try {
    if (state.editingId != null) {
      await api.updateStory(state.editingId, payload);
    } else {
      await api.createStory(payload);
    }
    dialog.close();
    await load();
  } catch (err) {
    if (err instanceof ApiError && err.errors.length) {
      showErrors(err.errors);
    } else {
      showErrors(['Salvestamine ebaõnnestus.']);
    }
  }
}

// --- Drag and drop -------------------------------------------------------

/** Collect every card id in current DOM order, across all columns. */
function currentOrderIds() {
  const ids = [];
  for (const status of COLUMNS) {
    document.querySelectorAll(`[data-list="${status}"] .card`).forEach((card) => {
      ids.push(Number(card.dataset.id));
    });
  }
  return ids;
}

/**
 * Called by SortableJS after a drag completes. Persists a status change
 * (when the card moved to another column) and the new ordering, then reloads
 * so the board always reflects the saved state.
 */
async function onDragEnd(evt) {
  const id = Number(evt.item.dataset.id);
  const toStatus = evt.to.closest('.column').dataset.status;
  const fromStatus = evt.from.closest('.column').dataset.status;

  try {
    if (toStatus !== fromStatus) {
      await api.setStatus(id, toStatus);
    }
    await api.reorder(currentOrderIds());
  } catch (err) {
    // On error, the reload below restores the server's truth.
  }
  await load();
}

/** Make every column a SortableJS drop target sharing one group. */
function initDragAndDrop() {
  for (const status of COLUMNS) {
    const list = document.querySelector(`[data-list="${status}"]`);
    // eslint-disable-next-line no-new
    new window.Sortable(list, {
      group: 'stories',
      draggable: '.card',
      filter: '.icon-btn', // clicks on edit/delete must not start a drag
      preventOnFilter: false,
      animation: 150,
      ghostClass: 'card-ghost',
      onEnd: onDragEnd,
    });
  }
}

// --- Wiring --------------------------------------------------------------

/** Handle clicks on cards (edit / delete buttons) via event delegation. */
function handleBoardClick(event) {
  const card = event.target.closest('.card');
  if (!card) return;
  const story = state.stories.find((s) => s.id === Number(card.dataset.id));
  if (!story) return;

  const actionBtn = event.target.closest('[data-action]');
  if (!actionBtn) return;

  if (actionBtn.dataset.action === 'edit') {
    openEditDialog(story);
  } else if (actionBtn.dataset.action === 'delete') {
    deleteStory(story);
  }
}

function init() {
  document.getElementById('new-story-btn').addEventListener('click', openCreateDialog);
  document.getElementById('add-criterion').addEventListener('click', () => addCriterionRow());
  document.getElementById('board').addEventListener('click', handleBoardClick);
  form.addEventListener('submit', handleSubmit);
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  initDragAndDrop();
  load();
}

init();
