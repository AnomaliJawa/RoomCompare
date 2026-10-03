import { html } from '../utils/dom.js';
import { textField } from '../components/fields.js';
import { ACCOUNT_LIMITS } from '../utils/validate.js';

/** Both routes own their DOM: a store change mid-typing must not wipe the form. */

function page({ title, lede, form, alternate }) {
  return html`
    <section class="auth">
      <div class="auth__card">
        <div class="auth__head">
          <h1>${title}</h1>
          <p class="page-head__lede">${lede}</p>
        </div>
        <div class="auth__notice" data-auth-notice role="alert"></div>
        ${form}
        <p class="auth__alternate">${alternate}</p>
      </div>
    </section>
  `;
}

const emailField = () =>
  textField({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email', inputmode: 'email', plain: true });

export function renderLogin() {
  return page({
    title: 'Log in',
    lede: 'Your surveys are saved to your account, so they are there on any device you log in from.',
    form: html`<form class="auth__form" data-action="submit-login" novalidate>
      ${emailField()}
      ${textField({ name: 'password', label: 'Password', type: 'password', autocomplete: 'current-password' })}
      <button class="btn btn--primary auth__submit" type="submit">Log in</button>
    </form>`,
    alternate: html`No account yet? <a href="#/register">Create one</a>`,
  });
}

export function renderRegister() {
  return page({
    title: 'Create your account',
    lede: 'One account keeps every kos you survey, on any device you log in from. Photos stay on the device you add them on.',
    form: html`<form class="auth__form" data-action="submit-register" novalidate>
      ${textField({ name: 'name', label: 'Your name', autocomplete: 'name' })}
      ${emailField()}
      ${textField({
        name: 'password',
        label: 'Password',
        type: 'password',
        autocomplete: 'new-password',
        hint: `At least ${ACCOUNT_LIMITS.PASSWORD_MIN} characters.`,
      })}
      <button class="btn btn--primary auth__submit" type="submit">Create account</button>
    </form>`,
    alternate: html`Already have an account? <a href="#/login">Log in</a>`,
  });
}

/** The password is taken exactly as typed. */
export function readCredentials(form) {
  const value = (name) => form.elements.namedItem(name)?.value ?? '';
  return { name: value('name').trim(), email: value('email').trim(), password: value('password') };
}
