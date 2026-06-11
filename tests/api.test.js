import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Use a throwaway data file so tests never touch real data.
const dataFile = path.join(os.tmpdir(), `agile-test-${process.pid}.json`);
process.env.AGILE_DATA_FILE = dataFile;

const seed = JSON.parse(fs.readFileSync(new URL('../data/seed.json', import.meta.url)));

let server;
let store;
let base;

// Helper: perform a JSON request against the test server.
async function api(method, pathname, body) {
  const res = await fetch(base + pathname, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  // Import after AGILE_DATA_FILE is set so the store targets the temp file.
  const { createApp } = await import('../src/app.js');
  store = await import('../src/store.js');
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://localhost:${server.address().port}`;
});

beforeEach(() => {
  // Reset to a known seeded state before every test.
  fs.writeFileSync(dataFile, JSON.stringify(seed));
  store.load();
});

after(() => {
  server.close();
  fs.rmSync(dataFile, { force: true });
});

// --- GET ------------------------------------------------------------------

test('GET /api/stories returns the seeded stories sorted by priority', async () => {
  const { status, body } = await api('GET', '/api/stories');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 4);
  const todo = body.filter((s) => s.status === 'todo').map((s) => s.priority);
  assert.deepEqual(todo, [...todo].sort((a, b) => a - b));
});

test('GET /api/stories/:id returns one story, 404 when missing', async () => {
  const ok = await api('GET', '/api/stories/1');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.id, 1);

  const missing = await api('GET', '/api/stories/999');
  assert.equal(missing.status, 404);
});

// --- POST (create + validation) -------------------------------------------

test('POST /api/stories creates a story (201) with id, comments and timestamps', async () => {
  const { status, body } = await api('POST', '/api/stories', {
    title: 'Uus',
    description: 'kirjeldus',
    points: 4,
    status: 'todo',
    acceptanceCriteria: ['AC1'],
  });
  assert.equal(status, 201);
  assert.equal(body.title, 'Uus');
  assert.equal(body.points, 4);
  assert.deepEqual(body.comments, []);
  assert.ok(body.id);
  assert.match(body.createdAt, /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
});

test('POST rejects empty / negative / non-integer points with 400', async () => {
  const base = { title: 'X', acceptanceCriteria: ['AC1'] };

  const empty = await api('POST', '/api/stories', { ...base });
  assert.equal(empty.status, 400);
  assert.ok(empty.body.errors.length);

  const negative = await api('POST', '/api/stories', { ...base, points: -1 });
  assert.equal(negative.status, 400);

  const float = await api('POST', '/api/stories', { ...base, points: 2.5 });
  assert.equal(float.status, 400);
});

test('POST requires at least one acceptance criterion', async () => {
  const { status, body } = await api('POST', '/api/stories', {
    title: 'X',
    points: 3,
    acceptanceCriteria: [],
  });
  assert.equal(status, 400);
  assert.ok(body.errors.some((e) => /vastuvõtutingimus/i.test(e)));
});

// --- PUT / DELETE ---------------------------------------------------------

test('PUT /api/stories/:id updates a story; 404 when missing', async () => {
  const updated = await api('PUT', '/api/stories/1', {
    title: 'Muudetud',
    description: 'd',
    points: 9,
    status: 'doing',
    acceptanceCriteria: ['AC'],
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.title, 'Muudetud');
  assert.equal(updated.body.points, 9);
  assert.equal(updated.body.status, 'doing');

  const missing = await api('PUT', '/api/stories/999', {
    title: 'x',
    points: 1,
    acceptanceCriteria: ['AC'],
  });
  assert.equal(missing.status, 404);
});

test('DELETE /api/stories/:id returns 204, then 404 on repeat', async () => {
  const first = await api('DELETE', '/api/stories/1');
  assert.equal(first.status, 204);
  const second = await api('DELETE', '/api/stories/1');
  assert.equal(second.status, 404);
});
