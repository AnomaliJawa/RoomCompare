/** Leaflet loads on demand from the CDN; a blocked or slow CDN resolves null, and callers fall back to coordinates. */

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const LOAD_TIMEOUT_MS = 6000;

let leafletPromise = null;

export function loadLeaflet() {
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve) => {
    if (window.L) {
      resolve(window.L);
      return;
    }
    const timer = setTimeout(() => resolve(null), LOAD_TIMEOUT_MS);
    const done = (value) => {
      clearTimeout(timer);
      resolve(value);
    };
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = LEAFLET_CSS;
    document.head.append(style);

    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => done(window.L ?? null);
    script.onerror = () => done(null);
    document.head.append(script);
  });
  return leafletPromise;
}

export function addTiles(L, map) {
  // OpenStreetMap's tile policy requires this attribution.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
}
