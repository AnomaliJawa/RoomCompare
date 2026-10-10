import { useEffect, useRef, useState } from 'react';
import * as store from '../data/store.js';
import { pruneSurveyMedia } from '../data/media.js';
import * as distanceRefresh from '../services/distanceRefresh.js';
import { ROUTE_STATUS, rememberWalkingKm } from '../services/walkingRoute.js';
import { navigate } from '../router.js';
import { useWalkingDistance } from '../hooks/useWalkingDistance.js';
import {
  BATHROOM_TYPES,
  DISTANCE_BASIS,
  KOS_TYPES,
  RENT_SLIDER,
  ROOM_FACILITIES,
  ROOM_SIDE_CHOICES,
  SHARED_FACILITIES,
  STATUS,
  TOILET_TYPES,
  WORSHIP_PLACES,
  YES_NO,
  SURROUNDINGS,
} from '../constants.js';
import { guidance, rubricText } from '../content/guidance.js';
import { locale, msg, t } from '../i18n/index.js';
import { formatKosDistance } from '../utils/format.js';
import { FIELD_SECTION, findDuplicateName, validateSurvey } from '../utils/validate.js';
import { formValues, newSurveyId, readSurvey } from '../utils/surveyForm.js';
import { confirmDialog, toast } from '../components/feedback/feedback.js';
import { ComboField } from '../components/form/ComboField.jsx';
import {
  CheckboxGroup,
  CurrencyField,
  HowToContext,
  InfoButton,
  LikertField,
  RadioGroup,
  TextareaField,
  TextField,
} from '../components/form/fields.jsx';
import { HowToPanel } from '../components/form/HowToPanel.jsx';
import { MapPicker } from '../components/form/MapPicker.jsx';
import { MediaUploader } from '../components/form/MediaUploader.jsx';
import { SurveyGuide, SurveyGuideButton, firstSurveyGuide } from '../components/form/SurveyGuide.jsx';
import { Banner } from '../components/ui/Banner.jsx';
import { NotFound } from '../components/ui/EmptyState.jsx';
import { PageHead } from '../components/ui/PageHead.jsx';
import { button, control, cx, fieldHint, fieldLabel, meta } from '../components/ui/styles.js';

const guide = (key) => ({ key, ...guidance().FIELD_GUIDE[key] });

const NEARBY = SURROUNDINGS.filter((item) => !WORSHIP_PLACES.includes(item));

const DISTANCE_PLACEHOLDER = msg('Fills in once both pins are set');

/** Only an unreachable route fixes itself later; no route between the pins needs a pin moved. */
const DISTANCE_NOTES = {
  [ROUTE_STATUS.UNAVAILABLE]: msg(
    'The walking route can’t be reached right now, so this is the straight line. It’s replaced once the route can be measured.',
  ),
  [ROUTE_STATUS.NO_ROUTE]: msg(
    'No walking route was found between the pins, so this is the straight line. Check that both pins are on or beside a road.',
  ),
};

/** New surveys only: Cancel on an edit promises the saved version is untouched. */
const AUTOSAVE_MS = 30000;

/** Where an error sends focus: the control the answer goes in, never a field's ⓘ. */
function controlFor(form, field) {
  return (
    form.querySelector(`#f-${field}`) ??
    form.querySelector(`#${field}-address`) ??
    form.querySelector(`input[name="${field}"]`) ??
    form.querySelector(`[data-field="${field}"] :is(input, select, textarea, button):not([data-guide])`)
  );
}

const without = (errors, fields) => Object.fromEntries(Object.entries(errors).filter(([key]) => !fields.includes(key)));

function Section({ index, title, intro, errors, children }) {
  const intros = guidance().SECTION_INTROS;
  const count = Object.keys(errors).filter((key) => FIELD_SECTION[key] === index).length;
  return (
    // Below 360px a narrower inset keeps the longest choice, "Sitting (Western-style) toilet", on one line.
    <section className="rounded-md border border-rule bg-surface p-6 max-xs:p-4" data-section={index}>
      <div className="flex items-center gap-3">
        <span
          className="grid size-7 place-items-center rounded-sm bg-accent-tint font-narrow text-xs font-bold text-accent"
          aria-hidden="true"
        >
          {index}
        </span>
        <h2>{title}</h2>
        {count > 0 && (
          <span className="ml-auto rounded-sm border border-alert bg-alert-bg px-2 py-1 font-narrow text-xs font-semibold whitespace-nowrap text-alert" data-section-errors>
            {t('{count} to fix', { count })}
          </span>
        )}
      </div>
      <p className="mt-3 mb-6 max-w-measure border-l-2 border-rule pl-3 text-muted">{intros[intro]}</p>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

const twoUp = 'grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4';

function SurveyForm({ saved }) {
  const editing = Boolean(saved);
  const [surveyId] = useState(() => saved?.id ?? newSurveyId());
  // The record this form writes: an autosave makes one for a new survey.
  const record = useRef(saved?.id ?? '');
  const [values, setValues] = useState(() => {
    // A saved walking distance is kept for the same pins without asking again, even offline.
    if (saved?.kos?.distanceBasis === DISTANCE_BASIS.WALKING) {
      rememberWalkingKm(saved.kos.kosLocation, saved.kos.campusLocation, saved.kos.distanceKm);
    }
    return formValues(saved);
  });
  const latest = useRef(values);
  latest.current = values;

  const dirty = useRef(false);
  const markDirty = () => {
    dirty.current = true;
  };

  const [errors, setErrors] = useState({});
  const [summary, setSummary] = useState(0);
  const failedMode = useRef(null);
  const repairs = useRef(new Set());
  const [repairTick, setRepairTick] = useState(0);
  const focusFirst = useRef(null);

  const [autosaveNote, setAutosaveNote] = useState('');
  const [howTo, setHowTo] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const help = useRef(null);
  const form = useRef(null);

  const distance = useWalkingDistance(
    values.kosLocation,
    values.campusLocation,
    { km: saved?.kos?.distanceKm ?? null, basis: saved?.kos?.distanceBasis, status: null },
    { onMoved: markDirty },
  );

  const set = (key) => (value) => setValues((now) => ({ ...now, [key]: value }));

  /** After a failed submit, a fixed field is re-checked when it is left or committed; never mid-typing. */
  const recheck = (field) => {
    if (!failedMode.current || !field) return;
    repairs.current.add(field);
    setRepairTick((tick) => tick + 1);
  };

  useEffect(() => {
    if (!repairs.current.size) return;
    const fields = [...repairs.current];
    repairs.current.clear();
    const result = validateSurvey(readSurvey(values), { mode: failedMode.current });
    const fixed = fields.filter((field) => !result.errors[field]);
    if (fixed.length) setErrors((now) => without(now, fixed));
  }, [repairTick]);

  useEffect(() => {
    const node = form.current;
    const heard = (event) => {
      markDirty();
      if (event.type === 'change') recheck(event.target.closest?.('[data-field]')?.dataset.field);
    };
    const left = (event) => recheck(event.target.closest?.('[data-field]')?.dataset.field);
    node.addEventListener('input', heard);
    node.addEventListener('change', heard);
    node.addEventListener('focusout', left);
    return () => {
      node.removeEventListener('input', heard);
      node.removeEventListener('change', heard);
      node.removeEventListener('focusout', left);
    };
  }, []);

  // The background walking-distance refresh leaves a survey open here to the form.
  useEffect(() => {
    distanceRefresh.setOpenSurvey(surveyId);
    return () => distanceRefresh.setOpenSurvey(null);
  }, [surveyId]);

  useEffect(() => {
    if (!editing && firstSurveyGuide()) setGuideOpen(true);
  }, []);

  // A new survey autosaves quietly as a draft, so a dropped tab mid-visit costs nothing.
  useEffect(() => {
    if (editing) return undefined;
    const timer = setInterval(() => {
      if (!dirty.current) return;
      const data = readSurvey(latest.current);
      if (!data.kos.name) return;
      if (store.findSurvey(surveyId)) {
        store.updateSurvey(surveyId, data);
      } else {
        const now = new Date().toISOString();
        store.addSurvey({ id: surveyId, ownerId: 'me', status: STATUS.DRAFT, createdAt: now, updatedAt: now, ...data });
        // The form is now editing a real record rather than creating one.
        record.current = surveyId;
      }
      setAutosaveNote(t('Draft saved {time}', { time: new Date().toLocaleTimeString(locale()) }));
    }, AUTOSAVE_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const field = focusFirst.current;
    if (!field) return;
    focusFirst.current = null;
    controlFor(form.current, field)?.focus({ preventScroll: true });
    form.current.querySelector(`[data-field="${field}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [errors]);

  const submit = async (event) => {
    event.preventDefault();
    const intent = event.nativeEvent.submitter?.dataset.intent ?? 'draft';
    const data = readSurvey(latest.current);

    // Update keeps the record's status, so an edited draft is held to draft rules.
    const existing = record.current ? store.findSurvey(record.current) : null;
    const mode = intent === 'publish' || (intent === 'update' && existing?.status === STATUS.PUBLISHED) ? 'publish' : 'draft';

    const result = validateSurvey(data, { mode });
    if (!result.ok) {
      failedMode.current = mode;
      focusFirst.current = result.firstField;
      setErrors(result.errors);
      setSummary(Object.keys(result.errors).length);
      return;
    }
    setErrors({});
    setSummary(0);

    // Two kos can share a name, so this asks rather than refuses.
    const duplicate = findDuplicateName(store.getState().surveys, data.kos.name, { excludeId: record.current || surveyId });
    if (duplicate) {
      const proceed = await confirmDialog({
        title: t('You already have a survey with this name'),
        body: t('{name} in {area} is already saved. Save this one as well?', {
          name: duplicate.kos.name,
          area: duplicate.kos.kosLocation?.label ?? t('an unnamed location'),
        }),
        confirmLabel: t('Save anyway'),
        tone: 'primary',
      });
      if (!proceed) {
        document.getElementById('f-name')?.focus();
        return;
      }
    }

    const keptMedia = [...data.room.photoIds, ...data.bathroom.photoIds, ...data.shared.photoIds, ...data.additional.videoIds];
    const editingId = record.current;
    if (editingId) {
      // An autosaved draft is already a record, so publishing it promotes the same row.
      store.updateSurvey(editingId, intent === 'publish' ? { ...data, status: STATUS.PUBLISHED } : data);
      toast(intent === 'publish' ? t('Published') : t('Survey updated'));
    } else {
      const now = new Date().toISOString();
      store.addSurvey({
        id: surveyId,
        ownerId: 'me',
        status: intent === 'publish' ? STATUS.PUBLISHED : STATUS.DRAFT,
        createdAt: now,
        updatedAt: now,
        ...data,
      });
      toast(intent === 'publish' ? t('Published') : t('Saved as draft'));
    }
    // Dropped photos are destroyed only once the record without them is written.
    pruneSurveyMedia(editingId || surveyId, keptMedia).catch(() => null);
    navigate('/surveys');
  };

  // Photos chosen on an abandoned form are swept after the next login.
  const cancel = async () => {
    if (dirty.current) {
      const discard = await confirmDialog({
        title: t('Discard your changes?'),
        body: t('What you have entered on this form will not be saved.'),
        confirmLabel: t('Discard'),
      });
      if (!discard) return;
    }
    navigate('/surveys');
  };

  const pin = (key) => (point) => {
    set(key)(point);
    recheck(key);
  };
  const uploads = (key) => (ids) => {
    markDirty();
    set(key)(ids);
  };
  const score = (key) => ({
    name: key,
    value: values[key],
    onChange: set(key),
    guide: guide(key),
    rubric: rubricText(key, values[key]),
    error: errors[key],
  });
  const distanceShown = distance.km == null ? '' : formatKosDistance({ distanceKm: distance.km, distanceBasis: distance.basis });

  return (
    <HowToContext.Provider value={(key, trigger) => setHowTo({ key, trigger })}>
      <PageHead
        title={editing ? t('Edit survey') : t('New survey')}
        titleAside={<SurveyGuideButton buttonRef={help} onOpen={() => setGuideOpen(true)} />}
        lede={
          editing
            ? t('Change what you recorded. Cancel leaves the saved version untouched.')
            : t('Record what you saw during the visit. Only the kos name is needed to save a draft.')
        }
      />

      <form ref={form} className="flex flex-col gap-6" id="survey-form" noValidate onSubmit={submit}>
        <div className="mb-4" role="alert" hidden={!summary} data-error-summary>
          {summary > 0 && (
            <Banner
              tone="alert"
              message={
                summary === 1
                  ? t('One field needs attention before this survey can be published.')
                  : t('{count} fields need attention before this survey can be published.', { count: summary })
              }
            />
          )}
        </div>

        <Section index={1} title={t('Kos information')} intro="kos" errors={errors}>
          <div className={twoUp}>
            <TextField
              name="name"
              label={t('Kos name')}
              value={values.name}
              onChange={set('name')}
              placeholder={t('e.g. Kos Melati Residence')}
              guide={guide('name')}
              error={errors.name}
            />
            <CurrencyField
              name="rent"
              label={t('Monthly rent')}
              value={values.rent}
              onChange={set('rent')}
              guide={guide('rent')}
              slider={{ max: RENT_SLIDER.MAX, step: RENT_SLIDER.STEP }}
              error={errors.rent}
            />
          </div>
          <RadioGroup
            name="type"
            legend={t('Kos type')}
            value={values.type}
            onChange={set('type')}
            options={KOS_TYPES}
            guide={guide('type')}
            error={errors.type}
          />
          <TextField
            name="contactPhone"
            label={t('Owner or security phone')}
            value={values.contactPhone}
            onChange={set('contactPhone')}
            type="tel"
            inputMode="tel"
            plain
            placeholder={t('e.g. 0812-3456-7890')}
            guide={guide('contactPhone')}
          />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
            <MapPicker
              name="kosLocation"
              label={t('Pin the kos')}
              addressLabel={t('Kos address')}
              placeholder={t('e.g. Jl. Sumbersari 12, Malang')}
              point={values.kosLocation}
              onChange={pin('kosLocation')}
              guide={guide('kosLocation')}
              error={errors.kosLocation}
            />
            <MapPicker
              name="campusLocation"
              label={t('Pin the campus')}
              addressLabel={t('Campus address')}
              placeholder={t('e.g. Universitas Brawijaya')}
              point={values.campusLocation}
              onChange={pin('campusLocation')}
              guide={guide('campusLocation')}
              error={errors.campusLocation}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className={fieldLabel} htmlFor="f-distanceKm">
                {t('Distance to campus')}
              </label>
              <InfoButton guide={guide('distance')} />
            </div>
            {/* Display only: saving works the distance out again from the pins. */}
            <input
              className={control({ className: 'tabular-nums lining-nums' })}
              id="f-distanceKm"
              name="distanceKm"
              type="text"
              value={distanceShown}
              readOnly
              placeholder={distance.status === 'routing' ? t('Measuring the walking route…') : t(DISTANCE_PLACEHOLDER)}
              aria-describedby="f-distanceKm-status"
            />
            <span className={cx(fieldHint, 'empty:hidden')} id="f-distanceKm-status" role="status" aria-live="polite">
              {t(DISTANCE_NOTES[distance.status] ?? '')}
            </span>
            {/* OpenStreetMap's licence asks for its credit wherever its data is used. */}
            <span className="text-xs text-muted" data-credit>
              {t('Route data © OpenStreetMap contributors')}
            </span>
          </div>
        </Section>

        <Section index={2} title={t('Room')} intro="room" errors={errors}>
          <div className={twoUp}>
            <ComboField
              name="lengthM"
              label={t('Room length (m)')}
              value={values.lengthM}
              onChange={set('lengthM')}
              onPick={() => {
                markDirty();
                recheck('lengthM');
              }}
              values={ROOM_SIDE_CHOICES}
              unit="m"
              guide={guide('lengthM')}
              error={errors.lengthM}
            />
            <ComboField
              name="widthM"
              label={t('Room width (m)')}
              value={values.widthM}
              onChange={set('widthM')}
              onPick={() => {
                markDirty();
                recheck('widthM');
              }}
              values={ROOM_SIDE_CHOICES}
              unit="m"
              guide={guide('widthM')}
              error={errors.widthM}
            />
          </div>
          <CheckboxGroup
            name="roomFacility"
            legend={t('Room facilities')}
            options={ROOM_FACILITIES}
            selected={values.roomFacility}
            onChange={set('roomFacility')}
            guide={guide('roomFacility')}
          />
          <LikertField legend={t('Cleanliness')} {...score('cleanliness')} />
          <LikertField legend={t('Internet quality')} {...score('internet')} />
          <MediaUploader
            section="room"
            label={t('Room photos')}
            ids={values.roomPhotoIds}
            onChange={uploads('roomPhotoIds')}
            surveyId={surveyId}
            guide={guide('roomPhotos')}
          />
        </Section>

        <Section index={3} title={t('Bathroom')} intro="bathroom" errors={errors}>
          <RadioGroup
            name="bathroomType"
            legend={t('Bathroom type')}
            options={BATHROOM_TYPES}
            value={values.bathroomType}
            onChange={set('bathroomType')}
            guide={guide('bathroomType')}
          />
          <RadioGroup
            name="toiletType"
            legend={t('Toilet type')}
            options={TOILET_TYPES}
            value={values.toiletType}
            onChange={set('toiletType')}
            guide={guide('toiletType')}
          />
          <RadioGroup
            name="waterHeater"
            legend={t('Water heater')}
            options={YES_NO}
            value={values.waterHeater}
            onChange={set('waterHeater')}
            guide={guide('waterHeater')}
          />
          <MediaUploader
            section="bathroom"
            label={t('Bathroom photos')}
            ids={values.bathroomPhotoIds}
            onChange={uploads('bathroomPhotoIds')}
            surveyId={surveyId}
            guide={guide('bathroomPhotos')}
          />
        </Section>

        <Section index={4} title={t('Shared facilities')} intro="shared" errors={errors}>
          <CheckboxGroup
            name="sharedFacility"
            legend={t('Shared facilities')}
            options={SHARED_FACILITIES}
            selected={values.sharedFacility}
            onChange={set('sharedFacility')}
            guide={guide('sharedFacility')}
          />
          <MediaUploader
            section="shared"
            label={t('Shared facility photos')}
            ids={values.sharedPhotoIds}
            onChange={uploads('sharedPhotoIds')}
            surveyId={surveyId}
            guide={guide('sharedPhotos')}
          />
        </Section>

        <Section index={5} title={t('Surroundings')} intro="surroundings" errors={errors}>
          {/* Two groups, one list: the places of worship are named apart so each faith can be found. */}
          <CheckboxGroup
            name="surrounding"
            legend={t('Around the kos')}
            options={NEARBY}
            selected={values.surrounding.filter((item) => NEARBY.includes(item))}
            onChange={(next) => set('surrounding')([...next, ...values.surrounding.filter((item) => WORSHIP_PLACES.includes(item))])}
            guide={guide('surrounding')}
          />
          <CheckboxGroup
            name="worship"
            legend={t('Places of worship nearby')}
            options={WORSHIP_PLACES}
            selected={values.surrounding.filter((item) => WORSHIP_PLACES.includes(item))}
            onChange={(next) => set('surrounding')([...values.surrounding.filter((item) => NEARBY.includes(item)), ...next])}
            guide={guide('worship')}
          />
        </Section>

        <Section index={6} title={t('Additional information')} intro="additional" errors={errors}>
          <LikertField legend={t('Security')} {...score('security')} />
          <TextareaField
            name="notes"
            label={t('Additional notes')}
            value={values.notes}
            onChange={set('notes')}
            placeholder={t('Anything the sections above do not cover.')}
            guide={guide('notes')}
            error={errors.notes}
          />
          <MediaUploader
            section="video"
            kind="video"
            label={t('Videos (optional)')}
            ids={values.videoIds}
            onChange={uploads('videoIds')}
            surveyId={surveyId}
            guide={guide('videos')}
          />
        </Section>

        <div className="flex justify-end gap-2 pb-6 max-lg:flex-col-reverse max-lg:*:w-full">
          <span className={cx(meta, 'mr-auto max-lg:mr-0 max-lg:text-center')} role="status" aria-live="polite">
            {autosaveNote}
          </span>
          <button className={button({ variant: 'quiet' })} type="button" onClick={cancel}>
            {t('Cancel')}
          </button>
          {editing ? (
            <button className={button({ variant: 'primary' })} type="submit" data-intent="update">
              {t('Update')}
            </button>
          ) : (
            <>
              <button className={button({ variant: 'secondary' })} type="submit" data-intent="draft">
                {t('Save as draft')}
              </button>
              <button className={button({ variant: 'primary' })} type="submit" data-intent="publish">
                {t('Publish')}
              </button>
            </>
          )}
        </div>
      </form>

      <HowToPanel open={howTo} onClose={() => setHowTo(null)} />
      <SurveyGuide open={guideOpen} onClose={() => setGuideOpen(false)} returnFocus={help} />
    </HowToContext.Provider>
  );
}

/** New, or an edit of one of your own surveys; anything else cannot be edited here. */
export function SurveyFormPage({ params = {} }) {
  const [saved] = useState(() => (params.id ? store.findSurvey(params.id) : null));
  if (params.id && (!saved || !store.isOwnSurvey(params.id))) {
    return (
      <NotFound
        title={msg('That survey cannot be edited')}
        body={msg('It may have been deleted, or it belongs to someone else.')}
        backHref="#/surveys"
        backLabel={msg('Back to my surveys')}
      />
    );
  }
  return <SurveyForm saved={saved} />;
}
