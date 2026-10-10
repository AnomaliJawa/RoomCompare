import { describe, it, expect, afterEach } from 'vitest';
import * as en from '../../client/src/content/guidance.en.js';
import * as id from '../../client/src/content/guidance.id.js';
import { guidance, rubricText } from '../../client/src/content/guidance.js';
import { applyLanguage } from '../../client/src/i18n/index.js';
import { ID } from '../../client/src/i18n/id.js';
import { validateSurvey, LIMITS } from '../../client/src/utils/validate.js';
import { LIKERT, MAX_PHOTOS_PER_SECTION, RENT_SLIDER, ROOM_SIDE_CHOICES } from '../../client/src/constants.js';
import { MAX_VIDEOS } from '../../client/src/data/media.js';
import { MAX_SOURCE_BYTES, MAX_VIDEO_BYTES } from '../../client/src/utils/image.js';

const FIELDS = [
  'name', 'rent', 'type', 'contactPhone', 'kosLocation', 'campusLocation', 'distance',
  'lengthM', 'widthM', 'roomFacility', 'cleanliness', 'internet', 'roomPhotos',
  'bathroomType', 'toiletType', 'waterHeater', 'bathroomPhotos',
  'sharedFacility', 'sharedPhotos',
  'surrounding', 'worship',
  'security', 'notes', 'videos',
];

const empty = {
  kos: { name: '', type: null, kosLocation: null, campusLocation: null, rent: null },
  room: { lengthM: null, widthM: null, facilities: [], cleanliness: null, internet: null },
  additional: { security: null, notes: '', videoIds: [] },
};

const MB = 1024 * 1024;
const [FIRST_SIDE, LAST_SIDE] = [ROOM_SIDE_CHOICES[0], ROOM_SIDE_CHOICES[ROOM_SIDE_CHOICES.length - 1]];

/** How each language words what the tests hold the copy to. */
const LANGUAGES = [
  {
    name: 'English',
    copy: en,
    draft: 'Required, even for a draft',
    publish: 'Required',
    max: (n, locale) => `Max ${n.toLocaleString(locale)} characters`,
    locale: 'en-US',
    sides: `from ${FIRST_SIDE} to ${LAST_SIDE}`,
    photos: `Up to ${MAX_PHOTOS_PER_SECTION} photos, max ${MAX_SOURCE_BYTES / MB} MB each.`,
    videos: `Up to ${MAX_VIDEOS} videos, max ${MAX_VIDEO_BYTES / MB} MB each.`,
    scores: LIKERT.map((step) => step.label),
  },
  {
    name: 'Indonesian',
    copy: id,
    draft: 'Wajib, bahkan untuk draf',
    publish: 'Wajib',
    max: (n, locale) => `Maks. ${n.toLocaleString(locale)} karakter`,
    locale: 'id-ID',
    sides: `dari ${FIRST_SIDE} sampai ${LAST_SIDE}`,
    photos: `Hingga ${MAX_PHOTOS_PER_SECTION} foto, maks. ${MAX_SOURCE_BYTES / MB} MB per foto.`,
    videos: `Hingga ${MAX_VIDEOS} video, maks. ${MAX_VIDEO_BYTES / MB} MB per video.`,
    scores: LIKERT.map((step) => ID[step.label]),
  },
];

afterEach(() => applyLanguage('en'));

describe.each(LANGUAGES)('the $name guidance copy', (language) => {
  const { FIELD_GUIDE, SECTION_INTROS, RUBRICS } = language.copy;

  it('covers all 24 fields of the form, each but the distance with a short helper line', () => {
    expect(Object.keys(FIELD_GUIDE)).toEqual(FIELDS);
    for (const [key, guide] of Object.entries(FIELD_GUIDE)) {
      expect(guide.label, key).toBeTruthy();
      // Removed at the user's request; its panel says it all.
      if (key === 'distance') {
        expect(guide.helper).toBeUndefined();
        continue;
      }
      expect(guide.helper, key).toBeTruthy();
      expect(guide.helper, key).not.toMatch(/\n/);
      expect(guide.helper.length, key).toBeLessThanOrEqual(70);
    }
  });

  it('introduces each of the six sections', () => {
    expect(Object.keys(SECTION_INTROS)).toEqual(['kos', 'room', 'bathroom', 'shared', 'surroundings', 'additional']);
    Object.values(SECTION_INTROS).forEach((intro) => expect(intro).toBeTruthy());
  });

  // If a rule changes in validate.js without the copy, this fails rather than the panel misleading.
  it('says in the panel rules exactly what saving and publishing require', () => {
    const rulesStartWith = (prefix) =>
      Object.entries(FIELD_GUIDE)
        .filter(([, guide]) => guide.panel.rules.startsWith(prefix))
        .map(([key]) => key)
        .sort();
    const errors = (mode) => Object.keys(validateSurvey(empty, { mode }).errors).sort();

    expect(rulesStartWith(language.draft)).toEqual(errors('draft'));
    expect(rulesStartWith(language.publish)).toEqual(errors('publish'));
  });

  it('quotes the limits the app actually enforces', () => {
    expect(FIELD_GUIDE.name.counter).toBe(LIMITS.NAME_MAX);
    expect(FIELD_GUIDE.name.helper).toContain(language.max(LIMITS.NAME_MAX, language.locale));
    expect(FIELD_GUIDE.notes.counter).toBe(LIMITS.NOTES_MAX);
    expect(FIELD_GUIDE.notes.helper).toContain(language.max(LIMITS.NOTES_MAX, language.locale));
    expect(FIELD_GUIDE.rent.helper).toContain(`Rp${LIMITS.RENT_MAX.toLocaleString('id-ID')}`);
    expect(FIELD_GUIDE.rent.helper).toContain(`Rp${RENT_SLIDER.MAX.toLocaleString('id-ID')}`);
    expect(FIELD_GUIDE.rent.panel.what).toContain(`Rp${RENT_SLIDER.MAX.toLocaleString('id-ID')}`);
    for (const key of ['lengthM', 'widthM']) {
      expect(FIELD_GUIDE[key].helper).toContain(`${LIMITS.ROOM_MIN_M}–${LIMITS.ROOM_MAX_M}`);
      expect(FIELD_GUIDE[key].panel.rules).toContain(language.sides);
    }
    for (const key of ['roomPhotos', 'bathroomPhotos', 'sharedPhotos']) {
      expect(FIELD_GUIDE[key].helper).toBe(language.photos);
    }
    expect(FIELD_GUIDE.videos.helper).toBe(language.videos);
  });

  it('define all four levels of each score, named as the scale names them', () => {
    expect(Object.keys(RUBRICS)).toEqual(['cleanliness', 'internet', 'security']);
    for (const levels of Object.values(RUBRICS)) {
      expect(levels.map((level) => level.score)).toEqual([1, 2, 3, 4]);
      expect(levels.map((level) => level.label)).toEqual(language.scores);
      levels.forEach((level) => expect(level.text).toBeTruthy());
    }
    RUBRICS.internet.forEach((level) => expect(level.benchmark).toMatch(/Mbps/));
  });
});

describe('the two languages', () => {
  it('have the same parts, counters, shots, speeds and guide, so neither panel misses one', () => {
    for (const key of Object.keys(en.FIELD_GUIDE)) {
      const [english, indonesian] = [en.FIELD_GUIDE[key], id.FIELD_GUIDE[key]];
      expect(Object.keys(indonesian.panel), key).toEqual(Object.keys(english.panel));
      expect(indonesian.counter, key).toBe(english.counter);
      expect(indonesian.photos?.length, key).toBe(english.photos?.length);
    }
    expect(id.PANEL_PARTS.map(([part]) => part)).toEqual(en.PANEL_PARTS.map(([part]) => part));
    for (const key of Object.keys(en.RUBRICS)) {
      expect(id.RUBRICS[key].map((level) => level.benchmark)).toEqual(en.RUBRICS[key].map((level) => level.benchmark));
    }
    expect(id.SURVEY_GUIDE.sections.map((section) => [section.items.length, Boolean(section.ordered)])).toEqual(
      en.SURVEY_GUIDE.sections.map((section) => [section.items.length, Boolean(section.ordered)]),
    );
  });

  it('describe the distance the app measures, walking along the road, and its fallback', () => {
    expect(en.FIELD_GUIDE.distance.panel.what).toMatch(/^Walking distance along the road/);
    expect(en.FIELD_GUIDE.distance.panel.what).not.toMatch(/straight/i);
    expect(en.FIELD_GUIDE.distance.panel.rules).toMatch(/straight line is shown instead and marked/);
    expect(id.FIELD_GUIDE.distance.panel.what).toMatch(/^Jarak jalan kaki menyusuri jalan/);
    expect(id.FIELD_GUIDE.distance.panel.what).not.toMatch(/lurus/i);
    expect(id.FIELD_GUIDE.distance.panel.rules).toMatch(/garis lurus ditampilkan sebagai gantinya dan diberi tanda/);
  });

  it('follow the language chosen', () => {
    expect(guidance()).toBe(en);
    applyLanguage('id');
    expect(guidance()).toBe(id);
  });
});

describe('the score rubrics', () => {
  it('give one line per chosen score, with the speed to expect for internet', () => {
    expect(rubricText('cleanliness', 3)).toBe('3 Good: Floor, walls, and furniture are clean. Only minor wear.');
    expect(rubricText('internet', '2')).toBe(
      '2 Fair: Chat and browsing work; HD video and video calls sometimes stutter. Average Download 3–10 Mbps.',
    );
    expect(rubricText('security', null)).toBe('');
    expect(rubricText('noise', 1)).toBe('');
  });

  it('give the line in Indonesian when that is the language', () => {
    applyLanguage('id');
    expect(rubricText('internet', 2)).toBe(
      '2 Cukup: Chat dan browsing lancar; video HD dan video call kadang tersendat. Rata-rata Download 3–10 Mbps.',
    );
  });
});
