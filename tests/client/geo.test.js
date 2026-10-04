import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  distanceBetween,
  isValidLat,
  isValidLng,
  isValidPoint,
  formatCoordinate,
} from '../../client/src/utils/geo.js';

describe('haversineKm', () => {
  // Published great-circle distances; the requirement asks for 1%.
  const cases = [
    { name: 'Lowokwaru to Universitas Brawijaya', a: { lat: -7.9391, lng: 112.6167 }, b: { lat: -7.9526, lng: 112.6148 }, km: 1.51 },
    { name: 'London to Paris', a: { lat: 51.5074, lng: -0.1278 }, b: { lat: 48.8566, lng: 2.3522 }, km: 343.6 },
    { name: 'Jakarta to Surabaya', a: { lat: -6.2088, lng: 106.8456 }, b: { lat: -7.2575, lng: 112.7521 }, km: 664 },
    { name: 'one degree of latitude', a: { lat: 0, lng: 0 }, b: { lat: 1, lng: 0 }, km: 111.19 },
  ];

  cases.forEach(({ name, a, b, km }) => {
    it(`is within 1% for ${name}`, () => {
      const got = haversineKm(a, b);
      expect(Math.abs(got - km) / km).toBeLessThan(0.01);
    });
  });

  it('is zero between identical points', () => {
    expect(haversineKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });

  it('is symmetric', () => {
    const a = { lat: -7.9391, lng: 112.6167 };
    const b = { lat: -7.9526, lng: 112.6148 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });

  it('crosses the antimeridian without exploding', () => {
    const km = haversineKm({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 });
    expect(km).toBeLessThan(30);
  });
});

describe('missing coordinates', () => {
  // Number(null) is 0: an unpinned coordinate once measured to the prime meridian.
  it('rejects null, undefined and empty strings rather than reading them as zero', () => {
    expect(isValidLat(null)).toBe(false);
    expect(isValidLat(undefined)).toBe(false);
    expect(isValidLat('')).toBe(false);
    expect(isValidLat('   ')).toBe(false);
    expect(isValidLng(null)).toBe(false);
  });

  it('still accepts a genuine zero', () => {
    expect(isValidLat(0)).toBe(true);
    expect(isValidLng(0)).toBe(true);
    expect(isValidPoint({ lat: 0, lng: 0 })).toBe(true);
    expect(distanceBetween({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.2, 1);
  });

  it('returns null rather than a distance when a point is incomplete', () => {
    expect(distanceBetween({ lat: 1, lng: null }, { lat: 2, lng: 2 })).toBeNull();
    expect(distanceBetween({ lat: '', lng: '' }, { lat: 2, lng: 2 })).toBeNull();
    expect(distanceBetween(null, { lat: 2, lng: 2 })).toBeNull();
    expect(distanceBetween(undefined, undefined)).toBeNull();
  });

  it('rejects out-of-range values', () => {
    expect(isValidLat(95)).toBe(false);
    expect(isValidLat(-95)).toBe(false);
    expect(isValidLng(181)).toBe(false);
    expect(isValidLat(90)).toBe(true);
    expect(isValidLng(-180)).toBe(true);
  });
});

describe('distanceBetween', () => {
  it('rounds to the precision the interface shows', () => {
    expect(distanceBetween({ lat: -7.9391, lng: 112.6167 }, { lat: -7.9526, lng: 112.6148 })).toBe(1.5);
  });
});

describe('formatCoordinate', () => {
  it('shows six decimals, enough to find a building', () => {
    expect(formatCoordinate({ lat: -7.9391, lng: 112.6167 })).toBe('-7.939100, 112.616700');
  });

  it('says so plainly when nothing is pinned', () => {
    expect(formatCoordinate(null)).toBe('Not pinned');
    expect(formatCoordinate({ lat: null, lng: null })).toBe('Not pinned');
  });
});
