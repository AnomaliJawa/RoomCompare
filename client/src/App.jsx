import { useEffect, useMemo, useRef, useState } from 'react';
import * as store from './data/store.js';
import { useStore } from './hooks/useStore.js';
import { navigate, startAt, useRoute } from './router.js';
import { requireAccount, restoreSession } from './actions/account.js';
import { ConfirmDialog } from './components/feedback/ConfirmDialog.jsx';
import { ToastRegion } from './components/feedback/ToastRegion.jsx';
import { NavBar } from './components/layout/NavBar.jsx';
import { Banner } from './components/ui/Banner.jsx';
import { button, meta } from './components/ui/styles.js';
import { LoginPage, RegisterPage } from './pages/AuthPage.jsx';
import { CommunityPage } from './pages/CommunityPage.jsx';
import { ComparePage } from './pages/ComparePage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { SurveyDetailPage } from './pages/SurveyDetailPage.jsx';
import { SurveyFormPage } from './pages/SurveyFormPage.jsx';
import { SurveyListPage } from './pages/SurveyListPage.jsx';

/**
 * `access`: public (log in and register, which a logged-in visitor skips), open (guests explore too),
 * or account. A guest sent to an account route logs in first, told why, or goes to Community.
 */
export const ROUTES = [
  { path: '/login', page: LoginPage, nav: null, access: 'public' },
  { path: '/register', page: RegisterPage, nav: null, access: 'public' },
  { path: '/dashboard', page: DashboardPage, nav: null, access: 'account' },
  { path: '/surveys', page: SurveyListPage, nav: 'surveys', access: 'open' },
  { path: '/surveys/new', page: SurveyFormPage, nav: 'surveys', access: 'account', reason: 'Log in to add a survey.' },
  { path: '/surveys/:id', page: SurveyDetailPage, nav: 'surveys', access: 'account', reason: 'Log in to see your surveys.' },
  { path: '/surveys/:id/edit', page: SurveyFormPage, nav: 'surveys', access: 'account', reason: 'Log in to edit your surveys.' },
  { path: '/community', page: CommunityPage, nav: 'community', access: 'open' },
  { path: '/community/:id', page: SurveyDetailPage, nav: 'community', access: 'open' },
  // Three kos columns plus the criteria get the wide column (the user's choice).
  { path: '/compare', page: ComparePage, nav: 'compare', access: 'open', wide: true },
];

/** Asked once per page load, however often React mounts the app (its development checks mount twice). */
let starting = null;

function NotFoundPage({ path }) {
  return (
    <section className="rounded-md border border-dashed border-rule bg-surface px-6 py-10 text-left">
      <p className="text-md font-semibold">Nothing at this address</p>
      <p className="mt-2 mb-4 text-muted">{path} does not match any page.</p>
      <a className={button({ variant: 'primary' })} href="#/dashboard">
        Go to the dashboard
      </a>
    </section>
  );
}

/** Storage problems, and the account's: offline, or a change the server refused. */
function Notices({ state, width }) {
  const { storageNotice, storageStatus, syncNotice, user } = state;
  // The account's notice means nothing on the login page.
  const accountNotice = user ? syncNotice : null;
  return (
    <div className={`mx-auto ${width} px-6 pt-6 empty:hidden max-lg:px-4`} role="status" aria-live="polite">
      {storageNotice && (
        <Banner
          message={storageNotice}
          tone={storageStatus === 'ok' ? 'info' : 'alert'}
          action={{ label: 'Dismiss', onClick: () => store.clearStorageNotice() }}
        />
      )}
      {accountNotice && <Banner message={accountNotice} action={{ label: 'Dismiss', onClick: () => store.setSyncNotice(null) }} />}
    </div>
  );
}

export function App() {
  const state = useStore();
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const main = useRef(null);
  const { path, route, params, visit } = useRoute(ROUTES);

  // The session decides the first screen, so ask before routing.
  useEffect(() => {
    starting ??= restoreSession();
    starting.finally(() => {
      startAt(store.getState().user ? '/dashboard' : '/community');
      setReady(true);
    });
  }, []);

  /**
   * Decided once per navigation, not on every store change: logging in sets the user while the
   * login form still shows its busy button, and that page must stay until the login is done.
   */
  const guard = useMemo(() => {
    if (!ready || !route) return null;
    const signedIn = Boolean(store.getState().user);
    if (route.access === 'public' && signedIn) return { to: '/dashboard' };
    if (route.access === 'account' && !signedIn) return route.reason ? { reason: route.reason } : { to: '/community' };
    return null;
  }, [ready, visit]);

  useEffect(() => {
    if (!guard) return;
    if (guard.reason) requireAccount(guard.reason, { replace: true });
    else navigate(guard.to, { replace: true });
  }, [guard]);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [visit]);

  const width = route?.wide ? 'max-w-column-wide' : 'max-w-column';

  let content = <p className={meta}>Loading…</p>;
  if (ready && !guard) {
    const Page = route?.page;
    content = Page ? <Page key={`${path}#${visit}`} params={params} /> : <NotFoundPage path={path} />;
  }

  return (
    <>
      {/* Focused, not followed: following it would change the hash this app routes by. */}
      <a
        className="absolute -top-16 left-4 z-60 rounded-sm border border-rule bg-surface px-4 py-2 font-semibold text-accent no-underline transition-[top] focus:top-2"
        href="#app-root"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>

      <NavBar
        ready={ready}
        user={ready ? state.user : null}
        auth={route?.access === 'public'}
        active={route?.nav ?? null}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
      />

      <Notices state={state} width={width} />

      <main ref={main} className={`mx-auto ${width} px-6 pt-10 pb-16 max-lg:px-4 max-lg:pt-6`} id="app-root" tabIndex={-1}>
        {content}
      </main>

      <ConfirmDialog />
      <ToastRegion />
    </>
  );
}
