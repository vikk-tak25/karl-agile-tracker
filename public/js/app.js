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
    await api.createStory(payload);
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

// --- Wiring --------------------------------------------------------------

function init() {
  document.getElementById('new-story-btn').addEventListener('click', openCreateDialog);
  document.getElementById('add-criterion').addEventListener('click', () => addCriterionRow());
  form.addEventListener('submit', handleSubmit);
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  load();
}

init();
