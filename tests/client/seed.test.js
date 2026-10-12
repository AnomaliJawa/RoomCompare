import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { ownSurveys } from '../../client/src/seed/ownSurveys.js';
import { communitySurveys } from '../../client/src/seed/communitySurveys.js';
import { hasRecorded } from '../../client/src/seed/samplePhotos.js';
import { MAX_PHOTOS_PER_SECTION, SAMPLE_PHOTO_PREFIX } from '../../client/src/constants.js';
import { distanceBetween } from '../../client/src/utils/geo.js';

const SECTIONS = ['room', 'bathroom', 'shared'];
const PHOTOS = 'client/public/seed-photos';
const all = [...ownSurveys, ...communitySurveys];
const fileOf = (id) => `${id.slice(SAMPLE_PHOTO_PREFIX.length)}.jpg`;

/** Width and height from a JPEG's frame header. */
function jpegSize(bytes) {
  for (let at = 2; at < bytes.length; at += 2 + bytes.readUInt16BE(at + 2)) {
    const marker = bytes[at + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return [bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5)];
  }
  return null;
}

describe('the sample surveys and their photos', () => {
  it('point only at images that ship with the app', () => {
    const ids = all.flatMap((survey) => SECTIONS.flatMap((section) => survey[section].photoIds));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id.startsWith(SAMPLE_PHOTO_PREFIX)).toBe(true);
      expect(existsSync(`${PHOTOS}/${fileOf(id)}`), id).toBe(true);
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

  it('give each kos photos of its own: no two surveys share one, and no two files are the same image', () => {
    const owner = new Map();
    for (const survey of all) {
      for (const id of SECTIONS.flatMap((section) => survey[section].photoIds)) {
        expect(owner.get(id), id).toBeUndefined();
        owner.set(id, survey.id);
      }
    }
    const digests = readdirSync(PHOTOS).map((name) => createHash('sha256').update(readFileSync(`${PHOTOS}/${name}`)).digest('hex'));
    expect(new Set(digests).size).toBe(digests.length);
  });

  it('ship no photo that no survey uses, each at most 1200 × 900', () => {
    const used = new Set(all.flatMap((survey) => SECTIONS.flatMap((section) => survey[section].photoIds)).map(fileOf));
    const files = readdirSync(PHOTOS);
    expect(files.filter((name) => !used.has(name))).toEqual([]);
    for (const name of files) {
      const [width, height] = jpegSize(readFileSync(`${PHOTOS}/${name}`));
      expect(width, name).toBeLessThanOrEqual(1200);
      expect(height, name).toBeLessThanOrEqual(900);
    }
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
