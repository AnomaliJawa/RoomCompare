import { describe, it, expect } from 'vitest';
import { validateSurvey, findDuplicateName, LIMITS, FIELD_SECTION } from '../../client/src/utils/validate.js';

/** A survey that satisfies the publish rules, for tests to spoil one field at a time. */
function complete(overrides = {}) {
  return {
    kos: {
      name: 'Kos Test',
      type: 'mixed',
      kosLocation: { lat: -7.9391, lng: 112.6167, label: 'Lowokwaru' },
      campusLocation: null,
      distanceKm: null,
      rent: 1_200_000,
      ...(overrides.kos ?? {}),
    },
    room: { lengthM: 3, widthM: 3, facilities: [], cleanliness: 3, internet: 3, photoIds: [], ...(overrides.room ?? {}) },
    bathroom: { facilities: [], photoIds: [] },
    shared: { facilities: [], photoIds: [] },
    surroundings: [],
    additional: { security: 3, notes: '', videoIds: [], ...(overrides.additional ?? {}) },
  };
}

const publish = (o) => validateSurvey(complete(o), { mode: 'publish' });
const draft = (o) => validateSurvey(complete(o), { mode: 'draft' });

describe('a complete survey', () => {
  it('passes both rule sets', () => {
    expect(publish().ok).toBe(true);
    expect(draft().ok).toBe(true);
  });
});

describe('kos name', () => {
  it('is required for a draft as well as a publish', () => {
    expect(draft({ kos: { name: '' } }).errors.name).toBeTruthy();
    expect(publish({ kos: { name: '' } }).errors.name).toBeTruthy();
  });

  it('treats whitespace as blank', () => {
    expect(draft({ kos: { name: '   ' } }).errors.name).toBeTruthy();
  });

  it('accepts exactly the limit and rejects one more', () => {
    expect(publish({ kos: { name: 'x'.repeat(LIMITS.NAME_MAX) } }).ok).toBe(true);
    expect(publish({ kos: { name: 'x'.repeat(LIMITS.NAME_MAX + 1) } }).errors.name).toBeTruthy();
  });
});

describe('monthly rent', () => {
  it('is required to publish but not to save a draft', () => {
    expect(publish({ kos: { rent: null } }).errors.rent).toBeTruthy();
    expect(draft({ kos: { rent: null } }).ok).toBe(true);
  });

  it('accepts zero, which is a real amount', () => {
    expect(publish({ kos: { rent: 0 } }).ok).toBe(true);
  });

  it('rejects negatives and unusable numbers', () => {
    expect(publish({ kos: { rent: -1 } }).errors.rent).toBeTruthy();
    expect(publish({ kos: { rent: NaN } }).errors.rent).toBeTruthy();
    expect(publish({ kos: { rent: Infinity } }).errors.rent).toBeTruthy();
  });

  it('accepts the cap and flags anything above it', () => {
    expect(publish({ kos: { rent: LIMITS.RENT_MAX } }).ok).toBe(true);
    expect(publish({ kos: { rent: LIMITS.RENT_MAX + 1 } }).errors.rent).toMatch(/unusually high/);
  });

  it('rejects a malformed amount even in a draft', () => {
    expect(draft({ kos: { rent: -1 } }).errors.rent).toBeTruthy();
  });
});

describe('kos type and location', () => {
  it('requires a type to publish, from the known set', () => {
    expect(publish({ kos: { type: null } }).errors.type).toBeTruthy();
    expect(publish({ kos: { type: 'other' } }).errors.type).toBeTruthy();
    expect(draft({ kos: { type: null } }).ok).toBe(true);
  });

  it('requires a pin to publish', () => {
    expect(publish({ kos: { kosLocation: null } }).errors.kosLocation).toBeTruthy();
    expect(draft({ kos: { kosLocation: null } }).ok).toBe(true);
  });

  it('accepts no campus, but not half a campus pin', () => {
    expect(publish({ kos: { campusLocation: null } }).ok).toBe(true);
    expect(publish({ kos: { campusLocation: { lat: -7.9, lng: null } } }).errors.campusLocation).toBeTruthy();
  });

  it('accepts a campus with only a name and no pin', () => {
    expect(publish({ kos: { campusLocation: { lat: null, lng: null, label: 'Brawijaya' } } }).ok).toBe(true);
  });
});

describe('ratings', () => {
  it('are required to publish and optional in a draft', () => {
    expect(publish({ room: { cleanliness: null } }).errors.cleanliness).toBeTruthy();
    expect(publish({ room: { internet: null } }).errors.internet).toBeTruthy();
    expect(publish({ additional: { security: null } }).errors.security).toBeTruthy();
    expect(draft({ room: { cleanliness: null }, additional: { security: null } }).ok).toBe(true);
  });

  it('reject values outside 1 to 4, even in a draft', () => {
    expect(publish({ room: { cleanliness: 0 } }).errors.cleanliness).toBeTruthy();
    expect(publish({ room: { cleanliness: 5 } }).errors.cleanliness).toBeTruthy();
    expect(publish({ room: { cleanliness: 2.5 } }).errors.cleanliness).toBeTruthy();
    expect(draft({ room: { internet: 9 } }).errors.internet).toBeTruthy();
  });

  it('accept both ends of the scale', () => {
    expect(publish({ room: { cleanliness: 1 } }).ok).toBe(true);
    expect(publish({ room: { cleanliness: 4 } }).ok).toBe(true);
  });
});

describe('room dimensions', () => {
  it('are optional', () => {
    expect(publish({ room: { lengthM: null, widthM: null } }).ok).toBe(true);
  });

  it("are rejected outside 1–10 m (the user's range, 2026-10-03)", () => {
    expect([LIMITS.ROOM_MIN_M, LIMITS.ROOM_MAX_M]).toEqual([1, 10]);
    expect(publish({ room: { lengthM: 10.5 } }).errors.lengthM).toBe('Enter a size between 1 and 10 metres.');
    expect(publish({ room: { widthM: 0.5 } }).errors.widthM).toBeTruthy();
    expect(draft({ room: { widthM: 12 } }).errors.widthM).toBeTruthy();
  });

  it('accept the boundaries', () => {
    expect(publish({ room: { lengthM: LIMITS.ROOM_MIN_M, widthM: LIMITS.ROOM_MAX_M } }).ok).toBe(true);
  });
});

describe('notes', () => {
  it('accept the limit and reject one more', () => {
    expect(publish({ additional: { notes: 'x'.repeat(LIMITS.NOTES_MAX) } }).ok).toBe(true);
    expect(publish({ additional: { notes: 'x'.repeat(LIMITS.NOTES_MAX + 1) } }).errors.notes).toBeTruthy();
  });
});

describe('reporting', () => {
  it('names every problem on an empty publish', () => {
    const result = validateSurvey(
      {
        kos: { name: '', type: null, kosLocation: null, campusLocation: null, distanceKm: null, rent: null },
        room: { lengthM: null, widthM: null, facilities: [], cleanliness: null, internet: null, photoIds: [] },
        bathroom: { facilities: [], photoIds: [] },
        shared: { facilities: [], photoIds: [] },
        surroundings: [],
        additional: { security: null, notes: '', videoIds: [] },
      },
      { mode: 'publish' },
    );
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(
      ['cleanliness', 'internet', 'kosLocation', 'name', 'rent', 'security', 'type'].sort(),
    );
  });

  it('points focus at the first problem in form order, not check order', () => {
    const result = publish({ kos: { name: '', rent: null, type: null } });
    expect(result.firstField).toBe('name');
  });

  it('counts problems per numbered section', () => {
    const result = publish({ kos: { name: '', type: null }, room: { cleanliness: null } });
    expect(result.sectionCounts[1]).toBe(2);
    expect(result.sectionCounts[2]).toBe(1);
  });

  it('maps every reportable field to a section', () => {
    const result = validateSurvey(
      {
        kos: { name: '', type: null, kosLocation: null, campusLocation: null, distanceKm: null, rent: null },
        room: { lengthM: 99, widthM: 99, facilities: [], cleanliness: null, internet: null, photoIds: [] },
        bathroom: { facilities: [], photoIds: [] },
        shared: { facilities: [], photoIds: [] },
        surroundings: [],
        additional: { security: null, notes: 'x'.repeat(LIMITS.NOTES_MAX + 1), videoIds: [] },
      },
      { mode: 'publish' },
    );
    Object.keys(result.errors).forEach((field) => {
      expect(FIELD_SECTION[field], `${field} has no section`).toBeTypeOf('number');
    });
  });
});

describe('findDuplicateName', () => {
  const surveys = [
    { id: 'a', kos: { name: 'Kos Melati' } },
    { id: 'b', kos: { name: 'Casa Hijau' } },
  ];

  it('finds a match regardless of case or surrounding space', () => {
    expect(findDuplicateName(surveys, '  kos melati ')?.id).toBe('a');
  });

  it('ignores the survey being edited', () => {
    expect(findDuplicateName(surveys, 'Kos Melati', { excludeId: 'a' })).toBeNull();
  });

  it('returns null when nothing matches or the name is blank', () => {
    expect(findDuplicateName(surveys, 'Something Else')).toBeNull();
    expect(findDuplicateName(surveys, '   ')).toBeNull();
  });
});
