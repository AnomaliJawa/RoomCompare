import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { validateLogin, validateRegistration } from '../../client/src/utils/validate.js';
import { LoginPage, RegisterPage, readCredentials } from '../../client/src/pages/AuthPage.jsx';

describe('logging in, checked before it is sent', () => {
  it('asks for both fields, naming the fix', () => {
    const result = validateLogin({ email: '', password: '' });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual({ email: 'Enter your email address.', password: 'Enter your password.' });
    expect(result.firstField).toBe('email');
  });

  it('rejects something that is not an email address', () => {
    expect(validateLogin({ email: 'rahma@', password: 'x' }).errors.email).toBe('Enter an email address like name@example.com.');
  });

  it('passes a plausible pair; the server decides whether it is right', () => {
    expect(validateLogin({ email: ' rahma@example.com ', password: 'anything' }).ok).toBe(true);
  });
});

describe('creating an account, checked before it is sent', () => {
  it('needs a name, an email and a password of at least 8 characters', () => {
    const result = validateRegistration({ name: ' ', email: 'x', password: 'short' });
    expect(result.errors).toEqual({
      name: 'Enter your name.',
      email: 'Enter an email address like name@example.com.',
      password: 'Use at least 8 characters.',
    });
    expect(result.firstField).toBe('name');
  });

  it('caps the name and the password', () => {
    const result = validateRegistration({ name: 'R'.repeat(61), email: 'r@example.com', password: 'p'.repeat(129) });
    expect(result.errors.name).toBe('Use 60 characters or fewer.');
    expect(result.errors.password).toBe('Use 128 characters or fewer.');
  });

  it('accepts exactly 8 characters', () => {
    expect(validateRegistration({ name: 'Rahma', email: 'r@example.com', password: '12345678' }).ok).toBe(true);
  });
});

describe('after logging in', () => {
  it('always lands on the Dashboard, wherever the visitor was before', async () => {
    vi.resetModules();
    vi.doMock('../../client/src/services/sync.js', () => ({ start: async () => true, stop() {}, flush: async () => {}, pendingCount: () => 0 }));
    vi.doMock('../../client/src/services/distanceRefresh.js', () => ({ start() {}, stop() {}, setOpenSurvey() {} }));
    const account = await import('../../client/src/actions/account.js');
    window.location.hash = '#/surveys';
    await account.enter(async () => ({ user: { id: 'u1', email: 'a@example.test', name: 'A' } }), {});
    expect(window.location.hash).toBe('#/dashboard');
    vi.doUnmock('../../client/src/services/sync.js');
    vi.doUnmock('../../client/src/services/distanceRefresh.js');
  });
});

describe('the account pages', () => {
  beforeEach(() => localStorage.clear());

  it('lets a password manager and a phone keyboard do their jobs on login', () => {
    const { container } = render(<LoginPage />);
    expect(container.querySelector('form').hasAttribute('novalidate')).toBe(true);

    const email = screen.getByLabelText('Email');
    expect(email.id).toBe('f-email');
    expect(email.getAttribute('type')).toBe('email');
    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(email.getAttribute('inputmode')).toBe('email');
    expect(email.getAttribute('autocapitalize')).toBe('none');
    expect(email.getAttribute('spellcheck')).toBe('false');
    expect(screen.getByLabelText('Password').getAttribute('autocomplete')).toBe('current-password');
    expect(screen.getByRole('link', { name: 'Create one' }).getAttribute('href')).toBe('#/register');
  });

  it('asks for a new password when registering, and says how long', () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText('Your name').getAttribute('autocomplete')).toBe('name');
    const password = screen.getByLabelText('Password');
    expect(password.getAttribute('autocomplete')).toBe('new-password');
    expect(document.getElementById(password.getAttribute('aria-describedby')).textContent).toBe('At least 8 characters.');
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('#/login');
  });

  it('reads the form, trimming everything but the password', () => {
    expect(readCredentials({ name: '  Rahma ', email: ' rahma@example.com ', password: ' spaced out ' })).toEqual({
      name: 'Rahma',
      email: 'rahma@example.com',
      password: ' spaced out ',
    });
  });

  it('leaves survey fields as they were: no autocomplete, no email keyboard', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Password').hasAttribute('inputmode')).toBe(false);
  });

  it('says what to fix without sending anything, and puts focus on the first field', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    const email = screen.getByLabelText('Email');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById('error-email').textContent).toBe('Enter your email address.');
    expect(email.getAttribute('aria-describedby')).toContain('error-email');
    expect(document.activeElement).toBe(email);
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('clears a fixed field once it is left, never while typing', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    const email = screen.getByLabelText('Email');
    fireEvent.change(email, { target: { value: 'rahma@example.com' } });
    expect(document.getElementById('error-email')).not.toBeNull();
    fireEvent.blur(email);
    expect(document.getElementById('error-email')).toBeNull();
    // The password was not touched, so its error stays.
    expect(document.getElementById('error-password')).not.toBeNull();
  });

  it('shows the server’s refusal and gives the button back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: 'Email or password is incorrect.' }) })),
    );
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rahma@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong password' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    });
    expect(screen.getByRole('alert').textContent).toContain('Email or password is incorrect.');
    expect(screen.getByRole('button', { name: 'Log in' }).disabled).toBe(false);
    vi.unstubAllGlobals();
  });
});
