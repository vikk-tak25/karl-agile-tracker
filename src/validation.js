// Allowed story statuses (also the three Kanban columns).
export const STATUSES = ['todo', 'doing', 'done'];

/**
 * Validate the "points" field.
 * Points must be a non-empty, non-negative integer.
 * @returns {string|null} an error message, or null if valid.
 */
export function validatePoints(points) {
  if (points === undefined || points === null || points === '') {
    return 'Punktid on kohustuslikud.';
  }
  if (typeof points === 'string' && points.trim() === '') {
    return 'Punktid on kohustuslikud.';
  }
  const n = Number(points);
  if (!Number.isInteger(n)) {
    return 'Punktid peavad olema täisarv.';
  }
  if (n < 0) {
    return 'Punktid ei tohi olla negatiivsed.';
  }
  return null;
}

/**
 * Validate and normalise the body for creating/updating a story.
 * @returns {{ valid: boolean, errors: string[], value: object }}
 */
export function validateStoryInput(body = {}) {
  const errors = [];

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    errors.push('Pealkiri on kohustuslik.');
  }

  const pointsError = validatePoints(body.points);
  if (pointsError) {
    errors.push(pointsError);
  }

  const acceptanceCriteria = (Array.isArray(body.acceptanceCriteria) ? body.acceptanceCriteria : [])
    .map((c) => (typeof c === 'string' ? c.trim() : ''))
    .filter((c) => c.length > 0);
  if (acceptanceCriteria.length === 0) {
    errors.push('Vähemalt üks vastuvõtutingimus on kohustuslik.');
  }

  let status = body.status === undefined ? 'todo' : body.status;
  if (!STATUSES.includes(status)) {
    errors.push(`Staatus peab olema üks järgmistest: ${STATUSES.join(', ')}.`);
    status = 'todo';
  }

  const description = typeof body.description === 'string' ? body.description.trim() : '';

  return {
    valid: errors.length === 0,
    errors,
    value: {
      title,
      description,
      status,
      points: Number(body.points),
      acceptanceCriteria,
    },
  };
}
