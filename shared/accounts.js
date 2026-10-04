/** Account rules, shared by the app and the server, so the wording can never drift between them. */

export const ACCOUNT_LIMITS = {
  NAME_MAX: 60,
  EMAIL_MAX: 254,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function checkEmail(email, errors) {
  if (!email) errors.email = 'Enter your email address.';
  else if (email.length > ACCOUNT_LIMITS.EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter an email address like name@example.com.';
  }
}

function accountResult(errors, order) {
  const keys = Object.keys(errors);
  return { ok: keys.length === 0, errors, firstField: order.find((key) => keys.includes(key)) ?? null, sectionCounts: {} };
}

export function validateLogin({ email = '', password = '' }) {
  const errors = {};
  checkEmail(email.trim(), errors);
  if (!password) errors.password = 'Enter your password.';
  return accountResult(errors, ['email', 'password']);
}

export function validateRegistration({ name = '', email = '', password = '' }) {
  const errors = {};
  const trimmed = name.trim();
  if (!trimmed) errors.name = 'Enter your name.';
  else if (trimmed.length > ACCOUNT_LIMITS.NAME_MAX) errors.name = `Use ${ACCOUNT_LIMITS.NAME_MAX} characters or fewer.`;
  checkEmail(email.trim(), errors);
  if (password.length < ACCOUNT_LIMITS.PASSWORD_MIN) errors.password = `Use at least ${ACCOUNT_LIMITS.PASSWORD_MIN} characters.`;
  else if (password.length > ACCOUNT_LIMITS.PASSWORD_MAX) errors.password = `Use ${ACCOUNT_LIMITS.PASSWORD_MAX} characters or fewer.`;
  return accountResult(errors, ['name', 'email', 'password']);
}
