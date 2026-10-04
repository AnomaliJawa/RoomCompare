import * as store from '../data/store.js';
import { sweepOrphanedMedia } from '../data/media.js';
import * as api from '../services/api.js';
import * as sync from '../services/sync.js';
import * as distanceRefresh from '../services/distanceRefresh.js';
import { confirmDialog, toast } from '../components/feedback/feedback.js';
import { navigate } from '../router.js';

/** Logging in and out, and the session the app starts with. */

/** Where a visitor sent to log in was going, so a deep link such as #/compare survives the detour. */
let returnTo = null;
/** Anything but "nobody is logged in" when the app asked at start, said on the login page. */
let serverProblem = null;

export const rememberReturn = (path) => {
  returnTo = path;
};

export const startupProblem = () => serverProblem;

/** Pre-account surveys are offered to the first account; left out, they are kept aside, not deleted. */
function claimSurveys(count) {
  const one = count === 1;
  return confirmDialog({
    title: 'Add surveys from this device to your account?',
    body: `${one ? 'One survey was' : `${count} surveys were`} recorded on this device before you had an account. Added, ${
      one ? 'it is' : 'they are'
    } there wherever you log in. Left out, ${one ? 'it stays' : 'they stay'} stored on this device, out of sight.`,
    confirmLabel: 'Add to my account',
    cancelLabel: 'Leave out',
    tone: 'primary',
  });
}

function sessionEnded() {
  distanceRefresh.stop();
  store.setUser(null);
  navigate('/login');
  toast('Your session has ended. Log in again to keep saving to your account.');
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
  if (!(await signIn(user))) throw new api.ApiError(401, 'Your session could not be started. Try again.');
  serverProblem = null;
  const next = returnTo ?? '/dashboard';
  returnTo = null;
  navigate(next);
  if (done) toast(done);
}

export async function logOut() {
  // Anything waiting goes now if it can; only what still cannot is worth asking about.
  await sync.flush();
  const waiting = sync.pendingCount();
  if (waiting) {
    const leave = await confirmDialog({
      title: 'Log out before everything is saved?',
      body: `${waiting === 1 ? 'One change has' : `${waiting} changes have`} not reached your account yet. ${
        waiting === 1 ? 'It stays' : 'They stay'
      } on this device and will be sent the next time you log in here.`,
      confirmLabel: 'Log out',
      cancelLabel: 'Stay logged in',
      tone: 'primary',
    });
    if (!leave) return;
  }
  try {
    await api.logout();
  } catch (error) {
    // Only the server can end the HttpOnly session; clearing the screen alone would not log out.
    toast(error.offline ? 'You’re offline, so you can’t log out yet. Try again once you’re connected.' : error.message);
    return;
  }
  sync.stop();
  distanceRefresh.stop();
  store.forgetAccount();
  navigate('/login');
  toast('Logged out');
}
