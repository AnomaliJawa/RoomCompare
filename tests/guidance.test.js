import { describe, it, expect } from 'vitest';
import { FIELD_GUIDE, SECTION_INTROS, RUBRICS, rubricText } from '../src/content/guidance.js';
import { validateSurvey, LIMITS } from '../src/utils/validate.js';
import { LIKERT, MAX_PHOTOS_PER_SECTION } from '../src/constants.js';
import { MAX_VIDEOS } from '../src/media.js';
import { MAX_SOURCE_BYTES, MAX_VIDEO_BYTES } from '../src/utils/image.js';

const FIELDS = [
  'name', 'rent', 'type', 'contactPhone', 'kosLocation', 'kosLocationName', 'campusLocationName', 'campusLocation', 'distance',
  'lengthM', 'widthM', 'roomFacility', 'cleanliness', 'internet', 'roomPhotos',
  'bathroomFacility', 'bathroomPhotos',
  'sharedFacility', 'sharedPhotos',
  'surrounding',
  'security', 'notes', 'videos',
];

const empty = {
  kos: { name: '', type: null, kosLocation: null, campusLocation: null, rent: null },
  room: { lengthM: null, widthM: null, facilities: [], cleanliness: null, internet: null },
  additional: { security: null, notes: '', videoIds: [] },
};

const MB = 1024 * 1024;

describe('the guidance copy', () => {
  it('covers all 23 fields of the form, each with a short helper line', () => {
    expect(Object.keys(FIELD_GUIDE)).toEqual(FIELDS);
    for (const [key, guide] of Object.entries(FIELD_GUIDE)) {
      expect(guide.label, key).toBeTruthy();
      expect(guide.helper, key).toBeTruthy();
      expect(guide.helper, key).not.toMatch(/\n/);
      expect(guide.helper.length, key).toBeLessThanOrEqual(70);
    }
  });

  it('introduces each of the six sections', () => {
    expect(Object.keys(SECTION_INTROS)).toEqual(['kos', 'room', 'bathroom', 'shared', 'surroundings', 'additional']);
    Object.values(SECTION_INTROS).forEach((intro) => expect(intro).toBeTruthy());
  });

  // Each panel's rules say what saving and publishing need, as validation
  // enforces it. If a rule changes in validate.js without the copy, this
  // fails rather than the panel misleading.
  it('says in the panel rules exactly what saving and publishing require', () => {
    const rulesStartWith = (prefix) =>
      Object.entries(FIELD_GUIDE)
        .filter(([, guide]) => guide.panel.rules.startsWith(prefix))
        .map(([key]) => key)
        .sort();
    const errors = (mode) => Object.keys(validateSurvey(empty, { mode }).errors).sort();

    expect(rulesStartWith('Required, even for a draft')).toEqual(errors('draft'));
    expect(rulesStartWith('Required')).toEqual(errors('publish'));
  });

  it('quotes the limits the app actually enforces', () => {
    expect(FIELD_GUIDE.name.counter).toBe(LIMITS.NAME_MAX);
    expect(FIELD_GUIDE.name.helper).toContain(`Max ${LIMITS.NAME_MAX} characters`);
    expect(FIELD_GUIDE.notes.counter).toBe(LIMITS.NOTES_MAX);
    expect(FIELD_GUIDE.notes.helper).toContain(`Max ${LIMITS.NOTES_MAX.toLocaleString('en-US')} characters`);
    expect(FIELD_GUIDE.rent.helper).toContain(`Rp${LIMITS.RENT_MAX.toLocaleString('id-ID')}`);
    for (const key of ['lengthM', 'widthM']) {
      expect(FIELD_GUIDE[key].helper).toContain(`${LIMITS.ROOM_MIN_M}–${LIMITS.ROOM_MAX_M}`);
    }
    for (const key of ['roomPhotos', 'bathroomPhotos', 'sharedPhotos']) {
      expect(FIELD_GUIDE[key].helper).toBe(`Up to ${MAX_PHOTOS_PER_SECTION} photos, max ${MAX_SOURCE_BYTES / MB} MB each.`);
    }
    expect(FIELD_GUIDE.videos.helper).toBe(`Up to ${MAX_VIDEOS} videos, max ${MAX_VIDEO_BYTES / MB} MB each.`);
  });

  it('describes the distance the app measures, a straight line between the pins', () => {
    expect(FIELD_GUIDE.distance.helper).toMatch(/straight-line/i);
    expect(FIELD_GUIDE.distance.helper).not.toMatch(/road/i);
  });
});

describe('the score rubrics', () => {
  it('define all four levels of each score, named as the scale names them', () => {
    expect(Object.keys(RUBRICS)).toEqual(['cleanliness', 'internet', 'security']);
    for (const levels of Object.values(RUBRICS)) {
      expect(levels.map((level) => level.score)).toEqual([1, 2, 3, 4]);
      expect(levels.map((level) => level.label)).toEqual(LIKERT.map((step) => step.label));
      levels.forEach((level) => expect(level.text).toBeTruthy());
    }
    RUBRICS.internet.forEach((level) => expect(level.benchmark).toMatch(/Mbps/));
  });

  it('give one line per chosen score, with the speed to expect for internet', () => {
    expect(rubricText('cleanliness', 3)).toBe('3 Good: Floor, walls, and furniture are clean. Only minor wear.');
    expect(rubricText('internet', '2')).toBe(
      '2 Fair: Chat and browsing work; HD video and video calls sometimes stutter. Average Download 3–10 Mbps.',
    );
    expect(rubricText('security', null)).toBe('');
    expect(rubricText('noise', 1)).toBe('');
  });
});
