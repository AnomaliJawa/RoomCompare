import { html } from '../utils/dom.js';
import { textField } from '../components/fields.js';
import { ACCOUNT_LIMITS } from '../utils/validate.js';

/**
 * Log in, and create an account.
 *
 * Short on purpose: the product is the surveys, and the way in should not
 * feel like a form to fill before the real one. Each field says what it is
 * for, so a password manager can fill it and a phone offers the email
 * keyboard. Errors are checked on submit, as on the survey form, and the
 * server's answer — a taken email, a wrong password — lands in the same
 * places.
 *
 * Both routes own their DOM, like the survey form: a store change while
 * someone is typing must not wipe what they typed.
 */

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
    // Photos do not travel with the account, and this is where the
    // expectation is set.
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

/** What the form holds. The password is taken exactly as typed. */
export function readCredentials(form) {
  const value = (name) => form.elements.namedItem(name)?.value ?? '';
  return { name: value('name').trim(), email: value('email').trim(), password: value('password') };
}
