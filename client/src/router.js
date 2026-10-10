import { useSyncExternalStore } from 'react';

/** Hash routing, so the app works from any static host without rewrite rules. */

const listeners = new Set();
/** Bumped by every navigation, including one to the page already shown, which opens it afresh. */
let visit = 0;

function changed() {
  visit += 1;
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') window.addEventListener('hashchange', changed);

export function currentPath() {
  const hash = window.location.hash.replace(/^#/, '');
  return hash === '' ? '/dashboard' : hash;
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (window.location.hash === target) {
    changed();
    return;
  }
  if (replace) {
    window.history.replaceState(null, '', target);
    changed();
  } else {
    window.location.hash = target;
  }
}

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

export function matchRoute(routes, path) {
  for (const route of routes) {
    route.match ??= compile(route.path);
    const params = route.match(path);
    if (params) return { route, params };
  }
  return { route: null, params: {} };
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The page to show: { path, route, params, visit }; visit changes with every navigation. */
export function useRoute(routes) {
  const at = useSyncExternalStore(subscribe, () => visit);
  const path = currentPath();
  return { path, visit: at, ...matchRoute(routes, path) };
}

/** An empty address starts where the visitor belongs: the Dashboard, or Community for a guest. */
export function startAt(path) {
  if (!window.location.hash) window.history.replaceState(null, '', `#${path}`);
}
