/**
 * Hash router.
 *
 * Hash rather than the History API so the app works from any static host with
 * no rewrite rules. The prototype had no URLs at all: refreshing always
 * returned to the dashboard and the back button left the app entirely.
 */

const routes = [];
let notFound = null;
let onNavigate = null;
let current = { path: '', name: '', params: {} };

/** `#/surveys/:id/edit` -> segment matcher. */
function compile(pattern) {
  const segments = pattern.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  return (path) => {
    const parts = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    if (parts.length !== segments.length) return null;
    const params = {};
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      if (segment.startsWith(':')) {
        params[segment.slice(1)] = decodeURIComponent(parts[i]);
      } else if (segment !== parts[i]) {
        return null;
      }
    }
    return params;
  };
}

export function defineRoute({ path, name, render }) {
  routes.push({ path, name, render, match: compile(path) });
}

export function setNotFound(render) {
  notFound = render;
}

export function currentRoute() {
  return current;
}

/** The path portion of the hash, always leading-slashed. */
export function currentPath() {
  const hash = window.location.hash.replace(/^#/, '');
  return hash === '' ? '/dashboard' : hash;
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (window.location.hash === target) {
    resolve();
    return;
  }
  if (replace) {
    window.history.replaceState(null, '', target);
    resolve();
  } else {
    window.location.hash = target;
  }
}

function resolve() {
  const path = currentPath();
  for (const route of routes) {
    const params = route.match(path);
    if (params) {
      current = { path, name: route.name, params };
      route.render(params);
      if (onNavigate) onNavigate(current);
      return;
    }
  }
  if (notFound) {
    current = { path, name: 'not-found', params: {} };
    notFound(path);
    if (onNavigate) onNavigate(current);
  }
}

export function startRouter({ onChange } = {}) {
  onNavigate = onChange;
  window.addEventListener('hashchange', resolve);
  if (!window.location.hash) {
    window.history.replaceState(null, '', '#/dashboard');
  }
  resolve();
}
