import { describe, it, expect } from 'vitest';
import { normalizeSurvey, worshipFor } from '../../client/src/utils/migrate.js';
import { SURROUNDINGS, WORSHIP_PLACES } from '../../client/src/constants.js';

const legacy = (facilities, surroundings = []) => ({ id: 'svy-old', bathroom: { facilities, photoIds: ['p1'] }, surroundings });

describe('a record from before the bathroom was split', () => {
  it('turns the ticks into the three answers, keeping the photos', () => {
    expect(normalizeSurvey(legacy(['Indoor bathroom', 'Western-style toilet', 'Water heater'])).bathroom).toEqual({
      type: 'indoor',
      toilet: 'sit',
      waterHeater: true,
      photoIds: ['p1'],
    });
    expect(normalizeSurvey(legacy(['Outdoor bathroom', 'Squat toilet'])).bathroom).toEqual({
      type: 'outdoor',
      toilet: 'squat',
      waterHeater: false,
      photoIds: ['p1'],
    });
  });

  it('leaves an answer unrecorded when the ticks do not say which', () => {
    // Both ticked names two bathrooms; none ticked names none.
    const both = normalizeSurvey(legacy(['Indoor bathroom', 'Outdoor bathroom', 'Squat toilet', 'Western-style toilet'])).bathroom;
    expect([both.type, both.toilet, both.waterHeater]).toEqual([null, null, false]);
    // A list never filled in says nothing about the water heater either.
    const empty = normalizeSurvey(legacy([])).bathroom;
    expect([empty.type, empty.toilet, empty.waterHeater]).toEqual([null, null, null]);
  });

  it('leaves a record already in the new shape exactly as it is', () => {
    const current = { id: 'svy-new', bathroom: { type: 'indoor', toilet: null, waterHeater: null, photoIds: [] }, surroundings: ['Laundry'] };
    expect(normalizeSurvey(current)).toBe(current);
    const once = normalizeSurvey(legacy(['Indoor bathroom'], ['Place of worship']));
    expect(normalizeSurvey(once)).toBe(once);
  });
});

describe('a record that names a place of worship but no faith', () => {
  it('names one of the five, in the form order, and keeps the other surroundings', () => {
    const { surroundings } = normalizeSurvey(legacy([], ['Place of worship', 'Laundry']));
    expect(surroundings).toHaveLength(2);
    expect(surroundings).toContain('Laundry');
    expect(WORSHIP_PLACES).toContain(surroundings.find((item) => item !== 'Laundry'));
    expect(surroundings).toEqual(SURROUNDINGS.filter((item) => surroundings.includes(item)));
  });

  it('chooses the same place for the same survey every time, on every device', () => {
    const first = normalizeSurvey({ ...legacy([], ['Place of worship']), id: 'svy-abc' }).surroundings;
    const again = normalizeSurvey({ ...legacy([], ['Place of worship']), id: 'svy-abc' }).surroundings;
    expect(again).toEqual(first);
    expect(first).toEqual([worshipFor('svy-abc')]);
  });

  it('spreads its choices across the five faiths', () => {
    const chosen = new Set(Array.from({ length: 60 }, (_, index) => worshipFor(`svy-${index}`)));
    expect(chosen.size).toBe(WORSHIP_PLACES.length);
  });
});
