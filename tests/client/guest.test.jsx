import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

// The server answers as it does for a visitor with no session.
const loggedOut = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: 'Log in first.' }) }));

async function app(hash = '') {
  vi.resetModules();
  window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
  const { App } = await import('../../client/src/App.jsx');
  const account = await import('../../client/src/actions/account.js');
  const surveys = await import('../../client/src/actions/surveys.js');
  render(<App />);
  await act(async () => {});
  return { account, surveys };
}

const go = (hash) =>
  act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', loggedOut);
  vi.stubGlobal('scrollTo', () => {});
});
afterEach(vi.unstubAllGlobals);

describe('a visitor without an account', () => {
  it('starts on Community, with every link, Log in and Add survey', async () => {
    await app();
    expect(window.location.hash).toBe('#/community');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['My surveys', 'Community', 'Compare', 'Log in']);
    expect(screen.getAllByRole('link', { name: 'Log in' }).map((link) => link.getAttribute('href'))).toEqual(['#/login', '#/login']);
    expect(screen.getByRole('link', { name: 'Add survey' }).getAttribute('href')).toBe('#/surveys/new');
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
  });

  it('opens a community survey in full', async () => {
    await app('#/community/com-kartika');
    expect(window.location.hash).toBe('#/community/com-kartika');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Kartika');
  });

  it('is sent from the Dashboard to Community', async () => {
    await app('#/dashboard');
    expect(window.location.hash).toBe('#/community');
  });

  it('is asked to log in to add a survey, and told why', async () => {
    await app('#/surveys/new');
    expect(window.location.hash).toBe('#/login');
    expect(document.querySelector('[data-login-reason]').textContent).toBe('Log in to add a survey.');
    // The account pages are the action, so the header does not repeat it.
    expect(screen.queryByRole('link', { name: 'Add survey' })).toBeNull();
  });

  it('keeps the reason when switching to Register, and drops it on leaving', async () => {
    await app('#/surveys/new');
    fireEvent.click(screen.getByRole('link', { name: 'Create one' }));
    await go('#/register');
    expect(document.querySelector('[data-login-reason]').textContent).toBe('Log in to add a survey.');
    await go('#/community');
    await go('#/login');
    expect(document.querySelector('[data-login-reason]')).toBeNull();
  });

  it('sees what My surveys is for, and how to start', async () => {
    await app('#/surveys');
    expect(screen.getByText('Log in to keep your surveys')).toBeTruthy();
    expect(screen.queryByLabelText('Search by kos name')).toBeNull();
    expect(screen.getByRole('link', { name: 'Create account' }).getAttribute('href')).toBe('#/register');
  });

  it('is asked to log in to like a kos, and nothing is liked', async () => {
    const { account, surveys } = await app('#/community');
    const store = await import('../../client/src/data/store.js');
    await act(async () => surveys.toggleLike('com-kartika'));
    expect(store.isLiked('com-kartika')).toBe(false);
    expect(window.location.hash).toBe('#/login');
    expect(account.pendingLoginReason()).toBe('Log in to like a kos.');
  });
});
