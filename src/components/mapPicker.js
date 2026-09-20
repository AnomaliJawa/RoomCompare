import { html, raw, qs, qsa } from '../utils/dom.js';
import { DEFAULT_CENTER, distanceBetween, formatCoordinate, isValidPoint } from '../utils/geo.js';

/**
 * Pin a place on a map.
 *
 * Leaflet and its OpenStreetMap tiles are loaded on demand rather than in the
 * page head, so a blocked or unreachable CDN degrades to typing coordinates
 * instead of leaving the form unusable. Recording a survey must never depend
 * on a third party being reachable.
 *
 * Geolocation is offered but never required: a denied prompt is an ordinary
 * outcome, not an error, and tapping the map still works.
 */

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const LOAD_TIMEOUT_MS = 6000;

let leafletPromise = null;

function loadLeaflet() {
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

/* --- Markup -------------------------------------------------------------- */

export function mapPickerField({ name, label, hint = '', point = null }) {
  const pinned = isValidPoint(point);
  return html`
    <div class="mappicker" data-mappicker="${name}">
      <div class="mappicker__head">
        <span class="field__label" id="${name}-label">${label}</span>
        <button class="btn btn--secondary btn--small" type="button" data-locate>
          Use my location
        </button>
      </div>

      <div class="mappicker__canvas" data-canvas role="application" aria-labelledby="${name}-label">
        <p class="mappicker__loading" data-loading>Loading map…</p>
      </div>

      <div class="mappicker__manual" data-manual hidden>
        <div class="form-grid">
          <div class="field">
            <label class="field__label" for="${name}-lat">Latitude</label>
            <input class="field__control numeric" id="${name}-lat" type="number" step="any"
              value="${pinned ? point.lat : ''}" data-lat-input autocomplete="off" />
          </div>
          <div class="field">
            <label class="field__label" for="${name}-lng">Longitude</label>
            <input class="field__control numeric" id="${name}-lng" type="number" step="any"
              value="${pinned ? point.lng : ''}" data-lng-input autocomplete="off" />
          </div>
        </div>
      </div>

      <p class="mappicker__readout">
        <span class="meta" data-readout>${formatCoordinate(point)}</span>
        ${hint ? raw(html`<span class="field__hint">${hint}</span>`) : ''}
      </p>

      <input type="hidden" name="${name}Lat" value="${pinned ? point.lat : ''}" data-lat />
      <input type="hidden" name="${name}Lng" value="${pinned ? point.lng : ''}" data-lng />
    </div>
  `;
}

/* --- Behaviour ----------------------------------------------------------- */

function mountOne(node, L, onChange) {
  const canvas = qs('[data-canvas]', node);
  const readout = qs('[data-readout]', node);
  const latField = qs('[data-lat]', node);
  const lngField = qs('[data-lng]', node);
  const manual = qs('[data-manual]', node);
  const locate = qs('[data-locate]', node);

  const current = () => ({ lat: latField.value, lng: lngField.value });

  function publish(point, { moveMap = true } = {}) {
    latField.value = point?.lat ?? '';
    lngField.value = point?.lng ?? '';
    readout.textContent = formatCoordinate(point);
    if (moveMap) place(point);
    onChange?.();
  }

  /* --- Fallback: no map, type the numbers ------------------------------- */
  if (!L) {
    canvas.hidden = true;
    manual.hidden = false;
    const latInput = qs('[data-lat-input]', node);
    const lngInput = qs('[data-lng-input]', node);

    const sync = () => {
      publish({ lat: latInput.value, lng: lngInput.value }, { moveMap: false });
    };
    latInput.addEventListener('input', sync);
    lngInput.addEventListener('input', sync);

    locate.addEventListener('click', () => {
      requestPosition((point) => {
        latInput.value = point.lat;
        lngInput.value = point.lng;
        sync();
      }, readout);
    });

    return { destroy() {} };
  }

  /* --- Map -------------------------------------------------------------- */
  qs('[data-loading]', canvas)?.remove();

  const start = isValidPoint(current()) ? current() : DEFAULT_CENTER;
  const map = L.map(canvas, { scrollWheelZoom: false }).setView(
    [Number(start.lat), Number(start.lng)],
    isValidPoint(current()) ? 16 : 13,
  );

  // OpenStreetMap's tile policy requires this attribution.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  let marker = null;

  function place(point) {
    if (!isValidPoint(point)) {
      if (marker) {
        marker.remove();
        marker = null;
      }
      return;
    }
    const latlng = [Number(point.lat), Number(point.lng)];
    if (marker) marker.setLatLng(latlng);
    else marker = L.marker(latlng, { draggable: true }).addTo(map);

    marker.off('dragend');
    marker.on('dragend', () => {
      const moved = marker.getLatLng();
      publish({ lat: moved.lat, lng: moved.lng }, { moveMap: false });
    });
  }

  place(current());

  map.on('click', (event) => {
    publish({ lat: event.latlng.lat, lng: event.latlng.lng }, { moveMap: false });
    place({ lat: event.latlng.lat, lng: event.latlng.lng });
    map.panTo(event.latlng);
  });

  locate.addEventListener('click', () => {
    requestPosition((point) => {
      publish(point, { moveMap: false });
      place(point);
      map.setView([point.lat, point.lng], 16);
    }, readout);
  });

  // The container is sized by CSS after mount, so Leaflet needs a nudge.
  setTimeout(() => map.invalidateSize(), 60);

  return {
    destroy() {
      map.remove();
    },
  };
}

/** Geolocation is a convenience. Refusal is expected and is not an error. */
function requestPosition(onPoint, readout) {
  if (!navigator.geolocation) {
    readout.textContent = 'This browser cannot report your location. Tap the map instead.';
    return;
  }
  readout.textContent = 'Finding your location…';
  navigator.geolocation.getCurrentPosition(
    (position) => onPoint({ lat: position.coords.latitude, lng: position.coords.longitude }),
    () => {
      readout.textContent = 'Location unavailable. Tap the map to pin it instead.';
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
  );
}

/**
 * Mount every picker in a form and keep the derived distance in step.
 * Returns a handle so the maps can be torn down when the view changes.
 */
export async function mountMapPickers(root, { onDistance } = {}) {
  const nodes = qsa('[data-mappicker]', root);
  if (!nodes.length) return { destroy() {} };

  const L = await loadLeaflet();
  if (!L) {
    // Say so once, rather than leaving three empty boxes unexplained.
    nodes.forEach((node) => {
      const readout = qs('[data-readout]', node);
      if (readout) readout.textContent = 'Map unavailable. Enter coordinates below.';
    });
  }

  const recalculate = () => {
    const read = (name) => {
      const node = qs(`[data-mappicker="${name}"]`, root);
      if (!node) return null;
      return { lat: qs('[data-lat]', node).value, lng: qs('[data-lng]', node).value };
    };
    onDistance?.(distanceBetween(read('kosLocation'), read('campusLocation')));
  };

  const handles = nodes.map((node) => mountOne(node, L, recalculate));
  recalculate();

  return {
    mapAvailable: Boolean(L),
    destroy: () => handles.forEach((handle) => handle.destroy()),
  };
}
