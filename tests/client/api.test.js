import { describe, it, expect, afterEach, vi } from 'vitest';
import * as api from '../../client/src/services/api.js';

const reply = (status, body, { json = true } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (!json) throw new SyntaxError('Unexpected token <');
    return body;
  },
});

function serve(...replies) {
  const fetch = vi.fn();
  replies.forEach((value) => (value instanceof Error ? fetch.mockRejectedValueOnce(value) : fetch.mockResolvedValueOnce(value)));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/** A connection that stays open until the request gives up on it. */
const neverSettles = (signal) =>
  new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the API client', () => {
  it('sends JSON to /api with the session cookie, and returns the reply', async () => {
    const user = { id: 'u1', name: 'Rahma', email: 'rahma@example.com' };
    const fetch = serve(reply(201, { user }));
    const result = await api.register({ name: 'Rahma', email: 'rahma@example.com', password: 'longenough' });

    expect(result).toEqual({ user });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/register');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('same-origin');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual({ name: 'Rahma', email: 'rahma@example.com', password: 'longenough' });
  });

  it('returns nothing for an empty 204 reply', async () => {
    serve(reply(204, null, { json: false }));
    await expect(api.logout()).resolves.toBeNull();
  });

  it("turns a refusal into an error carrying the server's own words", async () => {
    serve(reply(409, { error: 'An account with that email already exists. Log in instead.', errors: { email: 'Taken' } }));
    const error = await api.register({ name: 'R', email: 'a@b.co', password: 'longenough' }).catch((e) => e);
    expect(error).toBeInstanceOf(api.ApiError);
    expect(error.status).toBe(409);
    expect(error.message).toBe('An account with that email already exists. Log in instead.');
    expect(error.errors).toEqual({ email: 'Taken' });
    expect(error.offline).toBe(false);
  });

  it('treats a failed connection as offline', async () => {
    serve(new TypeError('Failed to fetch'));
    const error = await api.listSurveys().catch((e) => e);
    expect(error.status).toBe(0);
    expect(error.offline).toBe(true);
    expect(error.message).toMatch(/cannot be reached/);
  });

  it('treats a static server with no API as unreachable, not as a refusal', async () => {
    serve(reply(501, null, { json: false }));
    const error = await api.login({ email: 'a@b.co', password: 'x' }).catch((e) => e);
    expect(error.offline).toBe(true);
  });

  it('keeps any other unreadable failure distinct from offline', async () => {
    serve(reply(502, null, { json: false }));
    const error = await api.me().catch((e) => e);
    expect(error.status).toBe(502);
    expect(error.offline).toBe(false);
  });

  it('gives up on a request that never answers, as if offline, so it can be retried', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((url, { signal }) => neverSettles(signal)));

    let error = null;
    const settled = api.putSurvey({ id: 'svy-a' }).catch((e) => {
      error = e;
    });
    await vi.advanceTimersByTimeAsync(api.TIMEOUT_MS - 1);
    expect(error).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    await settled;
    expect(error).toBeInstanceOf(api.ApiError);
    expect(error.offline).toBe(true);
  });

  it('treats a reply cut off by the timeout as unreachable, not as an empty answer', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, { signal }) => ({ ok: true, status: 200, json: () => neverSettles(signal) })),
    );

    const settled = api.listSurveys().catch((e) => e);
    await vi.advanceTimersByTimeAsync(api.TIMEOUT_MS);
    expect((await settled).offline).toBe(true);
  });

  it('refuses a success that is not JSON rather than answering with nothing', async () => {
    serve(reply(200, null, { json: false }));
    const error = await api.listSurveys().catch((e) => e);
    expect(error).toBeInstanceOf(api.ApiError);
    expect(error.offline).toBe(false);
  });

  it('stops the clock once the reply is in', async () => {
    vi.useFakeTimers();
    serve(reply(200, { surveys: [] }));
    await expect(api.listSurveys()).resolves.toEqual({ surveys: [] });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('puts each survey at its own address, escaped', async () => {
    const fetch = serve(reply(204, null, { json: false }), reply(204, null, { json: false }));
    await api.putSurvey({ id: 'svy a/b', kos: { name: 'Kos' } });
    await api.deleteSurvey('svy a/b');
    expect(fetch.mock.calls[0][0]).toBe('/api/surveys/svy%20a%2Fb');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ survey: { id: 'svy a/b', kos: { name: 'Kos' } } });
    expect(fetch.mock.calls[1]).toEqual(['/api/surveys/svy%20a%2Fb', expect.objectContaining({ method: 'DELETE' })]);
  });
});
