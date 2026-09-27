import { describe, it, expect } from 'vitest';
import { validateLogin, validateRegistration } from '../src/utils/validate.js';
import { renderLogin, renderRegister, readCredentials } from '../src/features/auth.js';

const render = (markup) => {
  const host = document.createElement('div');
  host.innerHTML = String(markup);
  return host;
};

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

describe('the account pages', () => {
  it('lets a password manager and a phone keyboard do their jobs on login', () => {
    const host = render(renderLogin());
    const form = host.querySelector('form[data-action="submit-login"]');
    expect(form.hasAttribute('novalidate')).toBe(true);

    const email = form.querySelector('#f-email');
    expect(email.getAttribute('type')).toBe('email');
    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(email.getAttribute('inputmode')).toBe('email');
    expect(email.getAttribute('autocapitalize')).toBe('none');
    expect(email.getAttribute('spellcheck')).toBe('false');
    expect(form.querySelector('#f-password').getAttribute('autocomplete')).toBe('current-password');
    expect(host.querySelector('label[for="f-email"]').textContent.trim()).toBe('Email');
    expect(host.querySelector('a[href="#/register"]')).not.toBeNull();
  });

  it('asks for a new password when registering, and says how long', () => {
    const host = render(renderRegister());
    const form = host.querySelector('form[data-action="submit-register"]');
    expect(form.querySelector('#f-name').getAttribute('autocomplete')).toBe('name');
    const password = form.querySelector('#f-password');
    expect(password.getAttribute('autocomplete')).toBe('new-password');
    expect(host.querySelector(`#${password.getAttribute('aria-describedby')}`).textContent).toBe('At least 8 characters.');
    expect(host.querySelector('a[href="#/login"]')).not.toBeNull();
  });

  it('reads the form, trimming everything but the password', () => {
    const host = render(renderRegister());
    const form = host.querySelector('form');
    form.querySelector('#f-name').value = '  Rahma ';
    form.querySelector('#f-email').value = ' rahma@example.com ';
    form.querySelector('#f-password').value = ' spaced out ';
    expect(readCredentials(form)).toEqual({ name: 'Rahma', email: 'rahma@example.com', password: ' spaced out ' });
  });

  it('leaves survey fields as they were: no autocomplete, no email keyboard', () => {
    // textField's new options must not change the survey form it was built for.
    const host = render(renderLogin());
    expect(host.querySelector('#f-password').hasAttribute('inputmode')).toBe(false);
  });
});
