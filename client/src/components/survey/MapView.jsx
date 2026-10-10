import { useEffect, useRef, useState } from 'react';
import { addTiles, loadLeaflet } from '../../services/leaflet.js';
import { formatCoordinate, googleMapsUrl, isValidPoint } from '../../utils/geo.js';
import { cx, meta } from '../ui/styles.js';
import { t } from '../../i18n/index.js';

const latLng = (point) => [Number(point.lat), Number(point.lng)];

/** The kos pin on a map that only looks, with the campus when one is pinned; without Leaflet, the coordinates. */
export function MapView({ kos, campus = null, name }) {
  const canvas = useRef(null);
  const [leaflet, setLeaflet] = useState('loading');
  const withCampus = isValidPoint(campus);

  useEffect(() => {
    let live = true;
    let instance = null;
    loadLeaflet().then((L) => {
      if (!live) return;
      if (!L) {
        setLeaflet('unavailable');
        return;
      }
      setLeaflet('ready');
      instance = L.map(canvas.current, { scrollWheelZoom: false });
      addTiles(L, instance);
      L.marker(latLng(kos), { keyboard: false, title: name }).addTo(instance);
      if (withCampus) {
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
        L.circleMarker(latLng(campus), { radius: 8, color: accent, weight: 2, fillColor: accent, fillOpacity: 0.35 })
          .bindTooltip(t('Campus'))
          .addTo(instance);
        instance.fitBounds([latLng(kos), latLng(campus)], { padding: [40, 40], maxZoom: 16 });
      } else {
        instance.setView(latLng(kos), 16);
      }
      // The container is sized by CSS after mount, so Leaflet needs a nudge.
      setTimeout(() => live && instance.invalidateSize(), 60);
    });
    return () => {
      live = false;
      instance?.remove();
    };
  }, []);

  return (
    <div className="map-view flex flex-col gap-2" data-map-view>
      {/* Isolated, so Leaflet's own z-indexes stay inside the map, under the sticky nav. */}
      <div className="relative isolate h-72 overflow-hidden rounded-md border border-rule bg-paper max-lg:h-56" hidden={leaflet === 'unavailable'}>
        {/* Leaflet adds its own classes here, so React must never rewrite this element's class. */}
        <div ref={canvas} className="h-full" role="region" aria-label={withCampus ? t('Map of {name} and the campus', { name }) : t('Map of {name}', { name })} />
        {leaflet === 'loading' && <p className="absolute inset-0 grid place-items-center text-xs text-muted">{t('Loading map…')}</p>}
      </div>
      <p className={cx(meta, 'flex flex-wrap items-baseline gap-x-4 gap-y-1 tabular-nums lining-nums')}>
        <span data-coordinates>{formatCoordinate(kos)}</span>
        <a className="active:text-accent-press touch-hit" href={googleMapsUrl(kos)} target="_blank" rel="noopener">
          {t('Open in Google Maps')}
        </a>
      </p>
    </div>
  );
}
