import { useEffect, useRef, useState } from 'react';
import { DISTANCE_BASIS } from '../constants.js';
import { distanceBetween } from '../utils/geo.js';
import { ROUTE_STATUS, knownWalkingKm, walkingDistance } from '../services/walkingRoute.js';

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

/**
 * The distance to show between two pins: { km, basis, status }, where status is 'routing' while the
 * walk is measured, then the route's own status. Only a moved pin calls `onMoved`, never the first reading.
 */
export function useWalkingDistance(kos, campus, initial, { onMoved } = {}) {
  const [shown, setShown] = useState(initial);
  const previous = useRef(null);
  const moved = useRef(onMoved);
  moved.current = onMoved;

  useEffect(() => {
    // Running again for the same pins, as React's development checks do, is not a move.
    const pins = [kos.lat, kos.lng, campus.lat, campus.lng].join();
    const isFirst = previous.current === null || previous.current === pins;
    previous.current = pins;
    const controller = new AbortController();
    const report = (next) => {
      if (controller.signal.aborted) return;
      setShown(next);
      // A pin move fires no input event, so it is marked here, except for the first reading.
      if (!isFirst) moved.current?.();
    };

    (async () => {
      const from = { lat: kos.lat, lng: kos.lng };
      const to = { lat: campus.lat, lng: campus.lng };
      const straight = distanceBetween(from, to);
      if (straight === null) {
        report({ km: null, basis: null, status: ROUTE_STATUS.MISSING });
        return;
      }
      if (knownWalkingKm(from, to) === undefined) {
        report({ km: null, basis: null, status: 'routing' });
        // Typed coordinates change with every keystroke: wait for a pause before routing.
        if (!isFirst && !(await settle(controller.signal))) return;
      }
      const result = await walkingDistance(from, to, { signal: controller.signal });
      report(
        result.status === ROUTE_STATUS.OK
          ? { km: result.km, basis: DISTANCE_BASIS.WALKING, status: result.status }
          : { km: straight, basis: DISTANCE_BASIS.STRAIGHT, status: result.status },
      );
    })();

    return () => controller.abort();
  }, [kos.lat, kos.lng, campus.lat, campus.lng]);

  return shown;
}
