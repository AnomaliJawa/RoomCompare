import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { ownSurveys } from '../../client/src/seed/ownSurveys.js';
import { communitySurveys } from '../../client/src/seed/communitySurveys.js';
import { hasRecorded } from '../../client/src/seed/samplePhotos.js';
import { MAX_PHOTOS_PER_SECTION, SAMPLE_PHOTO_PREFIX } from '../../client/src/constants.js';
import { distanceBetween } from '../../client/src/utils/geo.js';

const SECTIONS = ['room', 'bathroom', 'shared'];
const all = [...ownSurveys, ...communitySurveys];

describe('the sample surveys and their photos', () => {
  it('point only at images that ship with the app', () => {
    const ids = all.flatMap((survey) => SECTIONS.flatMap((section) => survey[section].photoIds));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id.startsWith(SAMPLE_PHOTO_PREFIX)).toBe(true);
      expect(existsSync(`client/public/seed-photos/${id.slice(SAMPLE_PHOTO_PREFIX.length)}.jpg`), id).toBe(true);
    }
  });

  it('give every survey photos, within the limit, and none for a section with nothing recorded', () => {
    for (const survey of all) {
      expect(survey.room.photoIds.length, survey.id).toBeGreaterThan(0);
      for (const section of SECTIONS) {
        expect(survey[section].photoIds.length).toBeLessThanOrEqual(MAX_PHOTOS_PER_SECTION);
        if (!hasRecorded(survey, section)) expect(survey[section].photoIds, `${survey.id} ${section}`).toEqual([]);
        else expect(survey[section].photoIds.length, `${survey.id} ${section}`).toBeGreaterThan(0);
      }
    }
  });

  it('vary from one survey to the next, so neighbouring cards differ', () => {
    for (const list of [ownSurveys, communitySurveys]) {
      for (let i = 1; i < list.length; i += 1) {
        expect(list[i].room.photoIds[0]).not.toBe(list[i - 1].room.photoIds[0]);
      }
    }
    expect(communitySurveys[0].room.photoIds[0]).not.toBe(ownSurveys[0].room.photoIds[0]);
  });
});

describe('the distances in the sample surveys', () => {
  it('are walked, as the form measures them, so none is marked a straight line', () => {
    for (const survey of all) {
      const { distanceKm, distanceBasis, kosLocation, campusLocation } = survey.kos;
      expect(distanceBasis, survey.id).toBe('walking');
      // A walk is never shorter than the straight line between the same pins.
      expect(distanceKm, survey.id).toBeGreaterThanOrEqual(distanceBetween(kosLocation, campusLocation));
    }
  });
});
