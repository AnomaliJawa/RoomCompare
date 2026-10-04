import { useEffect, useRef, useState } from 'react';
import * as api from '../services/api.js';
import { enter, startupProblem } from '../actions/account.js';
import { ACCOUNT_LIMITS, validateLogin, validateRegistration } from '../utils/validate.js';
import { TextField } from '../components/form/fields.jsx';
import { Banner } from '../components/ui/Banner.jsx';
import { button } from '../components/ui/styles.js';

const KINDS = {
  login: {
    title: 'Log in',
    lede: 'Your surveys are saved to your account, so they are there on any device you log in from.',
    validate: validateLogin,
    call: api.login,
    label: 'Log in',
    busy: 'Logging in…',
    done: null,
    alternate: { text: 'No account yet? ', link: 'Create one', href: '#/register' },
  },
  register: {
    title: 'Create your account',
    lede: 'One account keeps every kos you survey, on any device you log in from. Photos stay on the device you add them on.',
    validate: validateRegistration,
    call: api.register,
    label: 'Create account',
    busy: 'Creating account…',
    done: 'Account created',
    alternate: { text: 'Already have an account? ', link: 'Log in', href: '#/login' },
  },
};

/** The password is taken exactly as typed. */
export const readCredentials = ({ name, email, password }) => ({ name: name.trim(), email: email.trim(), password });

function AuthPage({ kind }) {
  const page = KINDS[kind];
  const [typed, setTyped] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(startupProblem);
  const [busy, setBusy] = useState(false);
  const failed = useRef(false);
  const focusFirst = useRef(null);
  const form = useRef(null);
  const latest = useRef(typed);
  latest.current = typed;

  useEffect(() => {
    const field = focusFirst.current;
    if (!field) return;
    focusFirst.current = null;
    const control = form.current?.querySelector(`#f-${field}`);
    control?.focus({ preventScroll: true });
    control?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [errors]);

  const show = (found, first) => {
    failed.current = true;
    focusFirst.current = first;
    setErrors(found);
  };

  /** After a failed attempt, a fixed field is re-checked when it is left; never mid-typing. */
  const recheck = (event) => {
    const field = event.target.closest?.('[data-field]')?.dataset.field;
    if (!failed.current || !errors[field]) return;
    if (!page.validate(readCredentials(latest.current)).errors[field]) {
      setErrors(({ [field]: _, ...rest }) => rest);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const credentials = readCredentials(typed);
    const result = page.validate(credentials);
    if (!result.ok) {
      show(result.errors, result.firstField);
      return;
    }
    setErrors({});
    setNotice(null);
    setBusy(true);
    try {
      await enter(page.call, credentials, { done: page.done });
    } catch (error) {
      setBusy(false);
      if (error.errors) show(error.errors, Object.keys(error.errors)[0]);
      else setNotice(error.message);
    }
  };

  const field = (name) => ({
    name,
    value: typed[name],
    error: errors[name],
    onChange: (value) => setTyped((now) => ({ ...now, [name]: value })),
  });
  const emailField = (
    <TextField {...field('email')} label="Email" type="email" autoComplete="email" inputMode="email" plain />
  );

  return (
    <section className="flex justify-center pt-6 max-lg:pt-0">
      <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-md border border-rule bg-surface px-6 py-10 max-lg:px-4 max-lg:py-6">
        <div>
          <h1>{page.title}</h1>
          <p className="mt-2 text-muted">{page.lede}</p>
        </div>
        <div className="empty:hidden" role="alert" data-auth-notice>
          {notice && <Banner message={notice} tone="alert" />}
        </div>
        <form ref={form} className="flex flex-col gap-4" noValidate onSubmit={submit} onBlur={recheck}>
          {kind === 'register' ? (
            <>
              <TextField {...field('name')} label="Your name" autoComplete="name" />
              {emailField}
              <TextField
                {...field('password')}
                label="Password"
                type="password"
                autoComplete="new-password"
                hint={`At least ${ACCOUNT_LIMITS.PASSWORD_MIN} characters.`}
              />
            </>
          ) : (
            <>
              {emailField}
              <TextField {...field('password')} label="Password" type="password" autoComplete="current-password" />
            </>
          )}
          <button className={button({ variant: 'primary', className: 'mt-2 w-full' })} type="submit" disabled={busy}>
            {busy ? page.busy : page.label}
          </button>
        </form>
        <p className="text-muted">
          {page.alternate.text}
          <a className="touch-hit" href={page.alternate.href}>
            {page.alternate.link}
          </a>
        </p>
      </div>
    </section>
  );
}

export const LoginPage = () => <AuthPage kind="login" />;
export const RegisterPage = () => <AuthPage kind="register" />;
