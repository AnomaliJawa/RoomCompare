/**
 * The server's JSON API, and nothing else talks to it.
 *
 * Every failure becomes an ApiError carrying the HTTP status and a message a
 * person can act on. Status 0 means the server could not be reached at all —
 * offline, or no server running — which callers treat differently from a
 * refusal: an offline save is kept and retried, a refused one is not.
 *
 * The session lives in an HttpOnly cookie the browser sends by itself, so no
 * token is ever held in script or in storage.
 */

export class ApiError extends Error {
  constructor(status, message, errors = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }

  get offline() {
    return this.status === 0;
  }
}

const UNREACHABLE = 'RoomCompare’s server cannot be reached. Check your connection, then try again.';
const UNREADABLE = 'The server could not complete that. Try again.';

/**
 * How long a request may take before it counts as unreachable. A weak signal
 * can hold a connection open for minutes without failing it, and sync sends
 * one change at a time: a single stalled request would hold up every change
 * behind it, and Log out, which waits for them. Timed out, a change is
 * retried like any offline attempt; PUT and DELETE are safe to repeat.
 */
export const TIMEOUT_MS = 10_000;

async function request(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetch(`/api${path}`, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(0, UNREACHABLE);
    }

    if (response.status === 204) return null;

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // Cut off by the timeout part-way through the reply: as good as
      // unreachable. Otherwise the reply is not JSON at all — a proxy error
      // page, or a static server with no API.
      if (controller.signal.aborted) throw new ApiError(0, UNREACHABLE);
    }

    if (!response.ok) {
      if (payload) throw new ApiError(response.status, payload.error ?? UNREADABLE, payload.errors ?? null);
      // No JSON at all: a plain static server — the old devserver.py, say —
      // answers /api with an HTML 404, 405 or 501. To the app that is the same
      // as having no server.
      const noApi = [404, 405, 501].includes(response.status);
      throw new ApiError(noApi ? 0 : response.status, noApi ? UNREACHABLE : UNREADABLE);
    }
    // Every answer with a body is JSON. Anything else is not a success the
    // caller can use, and handing it null would fail later, less clearly.
    if (payload === null) throw new ApiError(response.status, UNREADABLE);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export const me = () => request('GET', '/me');
export const register = ({ name, email, password }) => request('POST', '/register', { name, email, password });
export const login = ({ email, password }) => request('POST', '/login', { email, password });
export const logout = () => request('POST', '/logout');

export const listSurveys = () => request('GET', '/surveys');
export const putSurvey = (survey) => request('PUT', `/surveys/${encodeURIComponent(survey.id)}`, { survey });
export const deleteSurvey = (id) => request('DELETE', `/surveys/${encodeURIComponent(id)}`);
