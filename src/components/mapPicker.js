import { html, raw, qs, qsa } from '../utils/dom.js';
import { infoButton } from './fields.js';
import { DEFAULT_CENTER, distanceBetween, formatCoordinate, isValidPoint } from '../utils/geo.js';
import { geocodeAddress, shortLabel, GEOCODE_STATUS } from '../utils/geocode.js';
import { walkingDistance, knownWalkingKm, ROUTE_STATUS } from '../utils/route.js';
import { DISTANCE_BASIS } from '../constants.js';

/** Leaflet loads on demand, so a blocked CDN degrades to typed coordinates; geolocation is optional. */

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const LOAD_TIMEOUT_MS = 6000;
const SETTLE_MS = 500;

function settle(signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(!signal.aborted), SETTLE_MS);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve(false);
      },
      { once: true },
    );
  });
}

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

export function mapPickerField({
  name,
  label,
  hint = '',
  point = null,
  addressLabel = 'Address',
  placeholder = 'Street, area, city',
  guide = null,
}) {
  const pinned = isValidPoint(point);
  const address = point?.address ?? '';
  const help = guide?.helper ?? hint;
  return html`
    <div class="mappicker" data-mappicker="${name}" data-field="${name}">
      <div class="mappicker__head">
        <span class="field__head">
          <span class="field__label" id="${name}-label">${label}</span>${infoButton(guide)}
        </span>
        <button class="btn btn--secondary btn--small" type="button" data-locate>
          Use my location
        </button>
      </div>

      <div class="mappicker__search">
        <label class="visually-hidden" for="${name}-address">${addressLabel}</label>
        <input
          class="field__control"
          id="${name}-address"
          name="${name}Address"
          type="text"
          value="${address ?? ''}"
          placeholder="${placeholder}"
          autocomplete="off"
          enterkeyhint="search"
          data-address
          aria-describedby="${name}-search-status"
        />
        <button class="btn btn--secondary" type="button" data-find>Find on map</button>
      </div>
      <p class="field__hint" id="${name}-search-status" data-search-status role="status" aria-live="polite"></p>

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
        ${help ? raw(html`<span class="field__hint">${help}</span>`) : ''}
      </p>

      <input type="hidden" name="${name}Lat" value="${pinned ? point.lat : ''}" data-lat />
      <input type="hidden" name="${name}Lng" value="${pinned ? point.lng : ''}" data-lng />
    </div>
  `;
}

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

    wireAddressSearch(node, (point) => {
      latInput.value = point.lat;
      lngInput.value = point.lng;
      sync();
    });

    return { destroy() {} };
  }

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

  wireAddressSearch(node, (point, result) => {
    publish(point, { moveMap: false });
    place(point);
    map.setView([point.lat, point.lng], 17);
    const labelField = document.querySelector(`#f-${node.dataset.mappicker}`);
    if (labelField && !labelField.value.trim()) {
      labelField.value = shortLabel(result.displayName);
      labelField.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // The container is sized by CSS after mount, so Leaflet needs a nudge.
  setTimeout(() => map.invalidateSize(), 60);

  return {
    destroy() {
      map.remove();
    },
  };
}

function wireAddressSearch(node, onFound) {
  const input = qs('[data-address]', node);
  const button = qs('[data-find]', node);
  const status = qs('[data-search-status]', node);
  if (!input || !button) return;

  async function search() {
    const query = input.value.trim();
    if (!query) {
      status.textContent = 'Enter an address to look up.';
      input.focus();
      return;
    }

    button.disabled = true;
    status.textContent = 'Looking up that address…';

    const result = await geocodeAddress(query);

    button.disabled = false;

    switch (result.status) {
      case GEOCODE_STATUS.OK:
        status.textContent = `Found ${result.displayName}`;
        onFound({ lat: result.lat, lng: result.lng }, result);
        break;
      case GEOCODE_STATUS.NOT_FOUND:
        status.textContent = 'No match for that address. Try a nearby landmark, or tap the map.';
        break;
      case GEOCODE_STATUS.THROTTLED:
        status.textContent = 'One moment — searches are limited to one a second.';
        break;
      case GEOCODE_STATUS.EMPTY:
        status.textContent = 'Enter an address to look up.';
        break;
      default:
        status.textContent = 'Address lookup is unavailable. Tap the map to pin it instead.';
    }
  }

  button.addEventListener('click', search);
  // Enter would otherwise submit the whole survey form.
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    search();
  });
}

/** Geolocation is a convenience; refusal is expected, not an error. */
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

/** onDistance hears { km, basis, status }: 'routing' first, then the walk or the straight line. */
export async function mountMapPickers(root, { onDistance } = {}) {
  const nodes = qsa('[data-mappicker]', root);
  if (!nodes.length) return { destroy() {} };

  const L = await loadLeaflet();
  if (!L) {
    nodes.forEach((node) => {
      const readout = qs('[data-readout]', node);
      if (readout) readout.textContent = 'Map unavailable. Enter coordinates below.';
    });
  }

  let routing = null;

  const recalculate = async ({ initial = false } = {}) => {
    const read = (name) => {
      const node = qs(`[data-mappicker="${name}"]`, root);
      if (!node) return null;
      return { lat: qs('[data-lat]', node).value, lng: qs('[data-lng]', node).value };
    };
    const kos = read('kosLocation');
    const campus = read('campusLocation');

    routing?.abort();
    const straight = distanceBetween(kos, campus);
    if (straight === null) {
      onDistance?.({ km: null, basis: null, status: ROUTE_STATUS.MISSING }, { initial });
      return;
    }

    const controller = new AbortController();
    routing = controller;
    if (knownWalkingKm(kos, campus) === undefined) {
      onDistance?.({ km: null, basis: null, status: 'routing' }, { initial });
      // Typed coordinates change with every keystroke: wait for a pause before routing.
      if (!initial && !(await settle(controller.signal))) return;
    }
    const result = await walkingDistance(kos, campus, { signal: controller.signal });
    if (controller.signal.aborted) return;
    onDistance?.(
      result.status === ROUTE_STATUS.OK
        ? { km: result.km, basis: DISTANCE_BASIS.WALKING, status: result.status }
        : { km: straight, basis: DISTANCE_BASIS.STRAIGHT, status: result.status },
      { initial },
    );
  };

  const handles = nodes.map((node) => mountOne(node, L, () => recalculate()));
  // Flagged initial: it runs after the form reset its dirty flag and is not the user's change.
  recalculate({ initial: true });

  return {
    mapAvailable: Boolean(L),
    destroy: () => {
      routing?.abort();
      handles.forEach((handle) => handle.destroy());
    },
  };
}
