import * as store from '../data/store.js';
import { sweepOrphanedMedia } from '../data/media.js';
import * as api from '../services/api.js';
import * as sync from '../services/sync.js';
import * as distanceRefresh from '../services/distanceRefresh.js';
import { confirmDialog, toast } from '../components/feedback/feedback.js';
import { navigate } from '../router.js';
import { t } from '../i18n/index.js';

/** Logging in and out, and the session the app starts with. */

/** Anything but "nobody is logged in" when the app asked at start, said on the login page. */
let serverProblem = null;
/** Why a guest was sent to log in, said on the login page. */
let loginReason = null;

export const startupProblem = () => serverProblem;
export const pendingLoginReason = () => loginReason;
export const clearLoginReason = () => {
  loginReason = null;
};

/** Guests explore freely; recording, comparing and liking need an account. */
export function requireAccount(reason, { replace = false } = {}) {
  loginReason = reason;
  navigate('/login', { replace });
}

/** Pre-account surveys are offered to the first account; left out, they are kept aside, not deleted. */
function claimSurveys(count) {
  return confirmDialog({
    title: t('Add surveys from this device to your account?'),
    body:
      count === 1
        ? t('One survey was recorded on this device before you had an account. Added, it is there wherever you log in. Left out, it stays stored on this device, out of sight.')
        : t('{count} surveys were recorded on this device before you had an account. Added, they are there wherever you log in. Left out, they stay stored on this device, out of sight.', { count }),
    confirmLabel: t('Add to my account'),
    cancelLabel: t('Leave out'),
    tone: 'primary',
  });
}

function sessionEnded() {
  distanceRefresh.stop();
  store.setUser(null);
  navigate('/login');
  toast(t('Your session has ended. Log in again to keep saving to your account.'));
}

/** Resolves false if it did not work out, in which case nobody is logged in. */
async function signIn(user) {
  store.setUser(user);
  try {
    if (!(await sync.start(user, { claimSurveys, onSessionEnded: sessionEnded }))) return false;
  } catch (error) {
    sync.stop();
    store.setUser(null);
    throw error;
  }
  // Distances still on a straight line are walked in the background.
  distanceRefresh.start();
  // Photos left by abandoned forms: this account's only.
  sweepOrphanedMedia(store.getState().surveys.map((survey) => survey.id), user.id).catch(() => null);
  return true;
}

/** The session decides the first screen, so the app asks before routing. */
export async function restoreSession() {
  try {
    const { user } = await api.me();
    await signIn(user);
  } catch (error) {
    // 401 is the ordinary logged-out answer; anything else is worth saying on the login page.
    if (error.status !== 401) serverProblem = error.message;
  }
}

/** `call` is api.login or api.register. Throws an ApiError, with field `errors` when the server names them. */
export async function enter(call, credentials, { done = null } = {}) {
  const { user } = await call(credentials);
  if (!(await signIn(user))) throw new api.ApiError(401, t('Your session could not be started. Try again.'));
  serverProblem = null;
  loginReason = null;
  // Always the Dashboard, wherever the visitor was (the user's rule).
  navigate('/dashboard');
  if (done) toast(t(done));
}

export async function logOut() {
  // Anything waiting goes now if it can; only what still cannot is worth asking about.
  await sync.flush();
  const waiting = sync.pendingCount();
  if (waiting) {
    const leave = await confirmDialog({
      title: t('Log out before everything is saved?'),
      body:
        waiting === 1
          ? t('One change has not reached your account yet. It stays on this device and will be sent the next time you log in here.')
          : t('{count} changes have not reached your account yet. They stay on this device and will be sent the next time you log in here.', { count: waiting }),
      confirmLabel: t('Log out'),
      cancelLabel: t('Stay logged in'),
      tone: 'primary',
    });
    if (!leave) return;
  }
  try {
    await api.logout();
  } catch (error) {
    // Only the server can end the HttpOnly session; clearing the screen alone would not log out.
    toast(error.offline ? t('You’re offline, so you can’t log out yet. Try again once you’re connected.') : error.message);
    return;
  }
  sync.stop();
  distanceRefresh.stop();
  store.forgetAccount();
  // Back to what a guest can explore.
  navigate('/community');
  toast(t('Logged out'));
}
