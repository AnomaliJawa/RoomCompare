import { describe, it, expect } from 'vitest';
import { filterSurveys } from '../src/features/surveyList.js';
import { filterCommunity } from '../src/features/community.js';
import { communitySurveys } from '../src/seed/communitySurveys.js';

const named = (name) => ({ kos: { name } });

describe('searching own surveys by name', () => {
  const surveys = [
    named('Kos Melati Residence'),
    named('Casa Hijau'),
    named('Kost Arwana'),
    named('Kos Séjahtera'),
  ];
  const names = (query) => filterSurveys(surveys, query).map((s) => s.kos.name);

  it('matches part of a name, ignoring case', () => {
    expect(names('melati')).toEqual(['Kos Melati Residence']);
    expect(names('MELATI')).toEqual(['Kos Melati Residence']);
    expect(names('MeLaTi')).toEqual(['Kos Melati Residence']);
  });

  it('matches inside a word, not only at the start', () => {
    expect(names('wana')).toEqual(['Kost Arwana']);
  });

  it('ignores accents in either direction', () => {
    // A search that misses a kos the user knows they saved reads as data loss.
    expect(names('sejahtera')).toEqual(['Kos Séjahtera']);
    expect(names('séjahtera')).toEqual(['Kos Séjahtera']);
  });

  it('returns everything for an empty or blank query', () => {
    expect(filterSurveys(surveys, '')).toHaveLength(4);
    expect(filterSurveys(surveys, '   ')).toHaveLength(4);
  });

  it('returns nothing when there is no match', () => {
    expect(names('zzzz')).toEqual([]);
  });

  it('can match more than one', () => {
    expect(names('kos')).toHaveLength(3);
  });
});

describe('filtering community surveys', () => {
  const surveys = [
    { id: 'a', ownerName: 'Rahma', kos: { name: 'Kos Kartika', type: 'female', rent: 1_650_000, kosLocation: { label: 'Ketawanggede, Malang' } } },
    { id: 'b', ownerName: 'Dimas', kos: { name: 'Pondok Biru', type: 'male', rent: 950_000, kosLocation: { label: 'Blimbing, Malang' } } },
    { id: 'c', ownerName: 'Sari', kos: { name: 'Griya Asri', type: 'mixed', rent: 1_450_000, kosLocation: { label: 'Dinoyo, Malang' } } },
  ];
  const base = { location: '', minRent: '', maxRent: '', type: '', starredOnly: false, facilities: [] };
  const ids = (filters, starred = []) => filterCommunity(surveys, { ...base, ...filters }, starred).map((s) => s.id);

  it('returns everything with no filters set', () => {
    expect(ids({})).toEqual(['a', 'b', 'c']);
  });

  it('matches part of a location, ignoring case', () => {
    expect(ids({ location: 'dinoyo' })).toEqual(['c']);
    expect(ids({ location: 'MALANG' })).toEqual(['a', 'b', 'c']);
  });

  it('filters by kos type', () => {
    expect(ids({ type: 'male' })).toEqual(['b']);
  });

  it('treats the rent range as inclusive at both ends', () => {
    expect(ids({ minRent: '1450000' })).toEqual(['a', 'c']);
    expect(ids({ maxRent: '1450000' })).toEqual(['b', 'c']);
    expect(ids({ minRent: '1450000', maxRent: '1450000' })).toEqual(['c']);
  });

  it('ignores an empty bound rather than reading it as zero', () => {
    expect(ids({ minRent: '', maxRent: '' })).toHaveLength(3);
  });

  it('narrows to starred only when asked', () => {
    expect(ids({ starredOnly: true }, ['a'])).toEqual(['a']);
    expect(ids({ starredOnly: true }, [])).toEqual([]);
  });

  it('combines filters, so each one narrows the last', () => {
    expect(ids({ location: 'malang', maxRent: '1500000', type: 'mixed' })).toEqual(['c']);
    expect(ids({ location: 'malang', maxRent: '1000000', type: 'mixed' })).toEqual([]);
  });
});

describe('facility requirements', () => {
  const base = { location: '', minRent: '', maxRent: '', type: '', starredOnly: false, facilities: [] };
  const names = (facilities, extra = {}) =>
    filterCommunity(communitySurveys, { ...base, ...extra, facilities }, []).map((s) => s.kos.name);

  it('narrows to kos that have the facility', () => {
    const withAC = names(['room:AC']);
    expect(withAC.length).toBeGreaterThan(0);
    expect(withAC.length).toBeLessThan(communitySurveys.length);
    withAC.forEach((name) => {
      const survey = communitySurveys.find((s) => s.kos.name === name);
      expect(survey.room.facilities).toContain('AC');
    });
  });

  it('requires every pick, not any of them', () => {
    const one = names(['room:AC']);
    const two = names(['room:AC', 'shared:Car parking']);
    expect(two.length).toBeLessThan(one.length);
    two.forEach((name) => {
      const survey = communitySurveys.find((s) => s.kos.name === name);
      expect(survey.room.facilities).toContain('AC');
      expect(survey.shared.facilities).toContain('Car parking');
    });
  });

  it('keeps narrowing as requirements are added', () => {
    const counts = [
      names(['room:AC']).length,
      names(['room:AC', 'shared:Car parking']).length,
      names(['room:AC', 'shared:Car parking', 'bathroom:Water heater']).length,
    ];
    expect(counts[0]).toBeGreaterThanOrEqual(counts[1]);
    expect(counts[1]).toBeGreaterThanOrEqual(counts[2]);
  });

  it('scopes a name to its section, since several appear in more than one', () => {
    // Refrigerator and Dispenser are room and shared facilities; an unscoped name would match either.
    expect(names(['room:Refrigerator'])).not.toEqual(names(['shared:Refrigerator']));
    expect(names(['room:Dispenser'])).not.toEqual(names(['shared:Dispenser']));

    names(['shared:Refrigerator']).forEach((name) => {
      const survey = communitySurveys.find((s) => s.kos.name === name);
      expect(survey.shared.facilities).toContain('Refrigerator');
    });
  });

  it('returns nothing when the requirements cannot all be met', () => {
    expect(names(['room:TV', 'room:AC', 'shared:Washing machine', 'bathroom:Water heater'], { maxRent: '900000' })).toEqual([]);
  });

  it('combines with the other filters', () => {
    const result = names(['bathroom:Water heater'], { type: 'female', maxRent: '1600000' });
    result.forEach((name) => {
      const survey = communitySurveys.find((s) => s.kos.name === name);
      expect(survey.kos.type).toBe('female');
      expect(survey.kos.rent).toBeLessThanOrEqual(1600000);
      expect(survey.bathroom.facilities).toContain('Water heater');
    });
  });

  it('ignores an empty requirement list', () => {
    expect(names([])).toHaveLength(communitySurveys.length);
  });
});

describe('the community seed', () => {
  it('holds enough varied surveys to exercise the filters', () => {
    expect(communitySurveys.length).toBeGreaterThanOrEqual(8);
    expect(communitySurveys.every(Boolean)).toBe(true);
    expect(new Set(communitySurveys.map((s) => s.id)).size).toBe(communitySurveys.length);
    expect(new Set(communitySurveys.map((s) => s.kos.type)).size).toBe(3);
  });

  it('is authored by other people, not the user', () => {
    communitySurveys.forEach((survey) => {
      expect(survey.ownerId).not.toBe('me');
      expect(survey.ownerName).toBeTruthy();
    });
  });
});
