import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { ownSurveys } from '../src/seed/ownSurveys.js';
import { communitySurveys } from '../src/seed/communitySurveys.js';
import { MAX_PHOTOS_PER_SECTION, SAMPLE_PHOTO_PREFIX } from '../src/constants.js';

const SECTIONS = ['room', 'bathroom', 'shared'];
const all = [...ownSurveys, ...communitySurveys];

describe('the sample surveys and their photos', () => {
  it('point only at images that ship with the app', () => {
    const ids = all.flatMap((survey) => SECTIONS.flatMap((section) => survey[section].photoIds));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id.startsWith(SAMPLE_PHOTO_PREFIX)).toBe(true);
      expect(existsSync(`seed-photos/${id.slice(SAMPLE_PHOTO_PREFIX.length)}.jpg`), id).toBe(true);
    }
  });

  it('give every survey photos, within the limit, and none for a section with nothing recorded', () => {
    for (const survey of all) {
      expect(survey.room.photoIds.length, survey.id).toBeGreaterThan(0);
      for (const section of SECTIONS) {
        expect(survey[section].photoIds.length).toBeLessThanOrEqual(MAX_PHOTOS_PER_SECTION);
        if (!survey[section].facilities.length) expect(survey[section].photoIds, `${survey.id} ${section}`).toEqual([]);
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
