/** Every request goes through here; failures become ApiError, and status 0 means unreachable. */

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

/** A stalled request would hold up every queued change; PUT and DELETE are safe to retry. */
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
      // Cut off mid-reply counts as unreachable; otherwise the reply is not JSON at all.
      if (controller.signal.aborted) throw new ApiError(0, UNREACHABLE);
    }

    if (!response.ok) {
      if (payload) throw new ApiError(response.status, payload.error ?? UNREADABLE, payload.errors ?? null);
      // A static server answers /api with HTML: to the app, that is no server.
      const noApi = [404, 405, 501].includes(response.status);
      throw new ApiError(noApi ? 0 : response.status, noApi ? UNREACHABLE : UNREADABLE);
    }
    // Every answer with a body is JSON; anything else is not a usable success.
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
