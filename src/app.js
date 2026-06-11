import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import storiesRouter from './routes/stories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

/**
 * Build and configure the Express application.
 * Kept as a factory so tests can spin up an app without starting a server.
 */
export function createApp() {
  const app = express();

  // Parse JSON request bodies for the REST API.
  app.use(express.json());

  // Serve the static frontend (Kanban board) from /public.
  app.use(express.static(publicDir));

  // Simple health check, handy for smoke tests.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'agile-tracker' });
  });

  // REST API for stories.
  app.use('/api/stories', storiesRouter);

  return app;
}
