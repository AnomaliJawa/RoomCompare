import { describe, it, expect } from 'vitest';
import { filterSurveys } from '../src/features/surveyList.js';
import { filterCommunity } from '../src/features/community.js';

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
  const base = { location: '', minRent: '', maxRent: '', type: '', starredOnly: false };
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
