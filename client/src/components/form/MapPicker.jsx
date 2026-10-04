import { useEffect, useRef, useState } from 'react';
import { DEFAULT_CENTER, formatCoordinate, isValidPoint } from '../../utils/geo.js';
import { GEOCODE_STATUS, geocodeAddress, shortLabel } from '../../services/geocode.js';
import { InfoButton, errorId } from './fields.jsx';
import { button, control, cx, fieldError, fieldHint, fieldLabel } from '../ui/styles.js';

/** Leaflet loads on demand, so a blocked CDN degrades to typed coordinates; geolocation is optional. */

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

const SEARCH_MESSAGES = {
  [GEOCODE_STATUS.NOT_FOUND]: 'No match for that address. Try a nearby landmark, or tap the map.',
  [GEOCODE_STATUS.THROTTLED]: 'One moment — searches are limited to one a second.',
  [GEOCODE_STATUS.EMPTY]: 'Enter an address to look up.',
};

/** Geolocation is a convenience; refusal is expected, not an error. */
function requestPosition(onPoint, say) {
  if (!navigator.geolocation) {
    say('This browser cannot report your location. Tap the map instead.');
    return;
  }
  say('Finding your location…');
  navigator.geolocation.getCurrentPosition(
    (position) => onPoint({ lat: position.coords.latitude, lng: position.coords.longitude }),
    () => say('Location unavailable. Tap the map to pin it instead.'),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
  );
}

/** A pin, its address and the area the lookup found: `point` is { label, address, lat, lng }. */
export function MapPicker({ name, label, point, onChange, addressLabel = 'Address', placeholder = 'Street, area, city', guide = null, error = '' }) {
  const canvas = useRef(null);
  const map = useRef(null);
  const latest = useRef({ point, onChange });
  latest.current = { point, onChange };
  const [leaflet, setLeaflet] = useState('loading');
  const [readout, setReadout] = useState(null);
  const [searchStatus, setSearchStatus] = useState('');
  const [searching, setSearching] = useState(false);

  /** Records a new pin; the map follows only when asked, since a click or drag has moved it already. */
  const publish = (coords, { view = null, extra = {} } = {}) => {
    const next = { ...latest.current.point, ...extra, lat: coords.lat, lng: coords.lng };
    setReadout(null);
    latest.current.onChange(next);
    map.current?.place(coords);
    if (view) map.current?.view(coords, view);
  };

  useEffect(() => {
    let live = true;
    loadLeaflet().then((L) => {
      if (!live) return;
      if (!L) {
        setLeaflet('unavailable');
        setReadout('Map unavailable. Enter coordinates below.');
        return;
      }
      setLeaflet('ready');
      const start = isValidPoint(latest.current.point) ? latest.current.point : DEFAULT_CENTER;
      const instance = L.map(canvas.current, { scrollWheelZoom: false }).setView(
        [Number(start.lat), Number(start.lng)],
        isValidPoint(latest.current.point) ? 16 : 13,
      );
      // OpenStreetMap's tile policy requires this attribution.
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(instance);

      let marker = null;
      const place = (coords) => {
        if (!isValidPoint(coords)) {
          marker?.remove();
          marker = null;
          return;
        }
        const at = [Number(coords.lat), Number(coords.lng)];
        if (marker) marker.setLatLng(at);
        else marker = L.marker(at, { draggable: true }).addTo(instance);
        marker.off('dragend');
        marker.on('dragend', () => {
          const moved = marker.getLatLng();
          publish({ lat: moved.lat, lng: moved.lng });
        });
      };
      place(latest.current.point);

      instance.on('click', (event) => {
        publish({ lat: event.latlng.lat, lng: event.latlng.lng });
        instance.panTo(event.latlng);
      });

      map.current = {
        place,
        view: (coords, zoom) => instance.setView([coords.lat, coords.lng], zoom),
        remove: () => instance.remove(),
      };
      // The container is sized by CSS after mount, so Leaflet needs a nudge.
      setTimeout(() => live && instance.invalidateSize(), 60);
    });
    return () => {
      live = false;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const search = async () => {
    const query = String(point.address ?? '').trim();
    if (!query) {
      setSearchStatus('Enter an address to look up.');
      document.getElementById(`${name}-address`)?.focus();
      return;
    }
    setSearching(true);
    setSearchStatus('Looking up that address…');
    const result = await geocodeAddress(query);
    setSearching(false);
    if (result.status === GEOCODE_STATUS.OK) {
      setSearchStatus(`Found ${result.displayName}`);
      // The lookup names the area: the form has no field to type it in.
      publish({ lat: result.lat, lng: result.lng }, { view: 17, extra: { label: shortLabel(result.displayName) } });
      return;
    }
    setSearchStatus(SEARCH_MESSAGES[result.status] ?? 'Address lookup is unavailable. Tap the map to pin it instead.');
  };

  const locate = () => requestPosition((coords) => publish(coords, { view: 16 }), setReadout);
  const help = guide?.helper ?? '';
  const typed = (key) => (event) => {
    setReadout(null);
    onChange({ ...point, [key]: event.target.value });
  };

  return (
    <div className="map-picker flex flex-col gap-2" data-field={name} data-invalid={error ? 'true' : undefined}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2">
          <span className={fieldLabel} id={`${name}-label`}>
            {label}
          </span>
          <InfoButton guide={guide} />
        </span>
        <button className={button({ size: 'small' })} type="button" onClick={locate}>
          Use my location
        </button>
      </div>

      <div className="flex gap-2 max-sm:flex-col">
        <label className="sr-only" htmlFor={`${name}-address`}>
          {addressLabel}
        </label>
        <input
          className={control({ width: 'w-full min-w-0 flex-1' })}
          id={`${name}-address`}
          name={`${name}Address`}
          type="text"
          value={point.address ?? ''}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          aria-describedby={cx(`${name}-search-status`, error && errorId(name))}
          aria-invalid={error ? 'true' : undefined}
          onChange={(event) => onChange({ ...point, address: event.target.value })}
          onKeyDown={(event) => {
            // Enter would otherwise submit the whole survey form.
            if (event.key !== 'Enter') return;
            event.preventDefault();
            search();
          }}
        />
        <button className={button({ className: 'shrink-0 max-sm:w-full' })} type="button" disabled={searching} onClick={search}>
          Find on map
        </button>
      </div>
      <p className={cx(fieldHint, 'empty:hidden')} id={`${name}-search-status`} role="status" aria-live="polite">
        {searchStatus}
      </p>

      {/* Isolated, so Leaflet's own z-indexes (200 to 1000) stay inside the map, under the sticky nav. */}
      <div
        className={cx('relative isolate h-60 overflow-hidden rounded-md border bg-paper', error ? 'border-alert' : 'border-rule')}
        hidden={leaflet === 'unavailable'}
      >
        {/* Leaflet adds its own classes here, so React must never rewrite this element's class. */}
        <div ref={canvas} className="h-full" role="application" aria-labelledby={`${name}-label`} />
        {leaflet === 'loading' && (
          <p className="absolute inset-0 grid place-items-center text-xs text-muted">Loading map…</p>
        )}
      </div>

      {leaflet === 'unavailable' && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          {[
            ['lat', 'Latitude'],
            ['lng', 'Longitude'],
          ].map(([key, text]) => (
            <div key={key} className="flex flex-col gap-2">
              <label className={fieldLabel} htmlFor={`${name}-${key}`}>
                {text}
              </label>
              <input
                className={control({ className: 'tabular-nums lining-nums' })}
                id={`${name}-${key}`}
                type="number"
                step="any"
                value={point[key] ?? ''}
                autoComplete="off"
                onChange={typed(key)}
              />
            </div>
          ))}
        </div>
      )}

      <p className="flex flex-col gap-1 tabular-nums lining-nums">
        <span className="text-xs text-muted" data-readout>
          {readout ?? formatCoordinate(point)}
        </span>
        {help && <span className={fieldHint}>{help}</span>}
      </p>

      {error && (
        <span className={fieldError} id={errorId(name)}>
          {error}
        </span>
      )}
    </div>
  );
}
