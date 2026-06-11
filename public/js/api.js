// Thin client around the REST API. Every method returns parsed JSON (or null
// for 204 responses) and throws ApiError on a non-OK response so the UI can
// show validation messages.

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors || [];
  }
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (res.status === 204) {
    return null;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errors = (data && data.errors) || (data && data.error ? [data.error] : []);
    throw new ApiError('API päring ebaõnnestus', res.status, errors);
  }

  return data;
}

export const api = {
  getStories: () => request('/api/stories'),
  getStory: (id) => request(`/api/stories/${id}`),
  createStory: (body) => request('/api/stories', { method: 'POST', body: JSON.stringify(body) }),
  updateStory: (id, body) =>
    request(`/api/stories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteStory: (id) => request(`/api/stories/${id}`, { method: 'DELETE' }),
  setStatus: (id, status) =>
    request(`/api/stories/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  reorder: (order) =>
    request('/api/stories/reorder', { method: 'PATCH', body: JSON.stringify({ order }) }),
  addComment: (id, text) =>
    request(`/api/stories/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
  deleteComment: (id, commentId) =>
    request(`/api/stories/${id}/comments/${commentId}`, { method: 'DELETE' }),
};
