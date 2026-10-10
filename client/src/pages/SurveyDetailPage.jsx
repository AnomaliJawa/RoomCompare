import * as store from '../data/store.js';
import { useStore } from '../hooks/useStore.js';
import { toggleCompare } from '../actions/surveys.js';
import {
  BATHROOM_TYPES,
  ROOM_FACILITIES,
  SHARED_FACILITIES,
  STATUS_LABELS,
  SURROUNDINGS,
  TOILET_TYPES,
  YES_NO,
  choiceLabel,
  kosTypeLabel,
  likertLabel,
} from '../constants.js';
import { campusName, formatKosDistance, numberToCurrency } from '../utils/format.js';
import { isValidPoint } from '../utils/geo.js';
import { MapView } from '../components/survey/MapView.jsx';
import { MediaGallery } from '../components/survey/PhotoGallery.jsx';
import { DeleteButton, EditLink, LikeButton, StarButton } from '../components/survey/SurveyButtons.jsx';
import { Breadcrumbs } from '../components/ui/Breadcrumbs.jsx';
import { NotFound } from '../components/ui/EmptyState.jsx';
import { PageHead } from '../components/ui/PageHead.jsx';
import { SectionHeading, sectionHead } from '../components/ui/SectionHeading.jsx';
import { button, cx, narrowLabel, panel, unrecorded } from '../components/ui/styles.js';

/** Missing values read "Not recorded": unknown and absent are different facts. */
function Value({ input }) {
  if (input === null || input === undefined || input === '') return <span className={unrecorded}>Not recorded</span>;
  return input;
}

const link = 'active:text-accent-press touch-hit';

function Definition({ label, input }) {
  return (
    <div data-defn={label}>
      <dt className={cx(narrowLabel, 'text-muted')}>{label}</dt>
      <dd className="mt-1 font-medium tabular-nums lining-nums">
        <Value input={input} />
      </dd>
    </div>
  );
}

const DefinitionList = ({ children }) => (
  <dl className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">{children}</dl>
);

/** The href keeps only digits and a leading +; the label stays as typed. */
function contact(phone) {
  if (!phone) return null;
  const href = phone.replace(/[^+0-9]/g, '');
  return href ? (
    <a className={link} href={`tel:${href}`}>
      {phone}
    </a>
  ) : (
    phone
  );
}

/** Every facility is listed, present or absent: "No AC" is information. */
function Checklist({ all, selected }) {
  const chosen = new Set(selected ?? []);
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-4 gap-y-2">
      {all.map((item) => {
        const present = chosen.has(item);
        return (
          <li key={item} className={cx('flex items-baseline gap-2', present ? 'text-ink' : 'text-muted')} data-present={present}>
            <span className={cx('w-[1em] font-semibold', present ? 'text-accent' : 'text-muted')} aria-hidden="true" data-mark>
              {present ? '✓' : '✗'}
            </span>
            <span>{item}</span>
            <span className="sr-only">{present ? 'present' : 'not available'}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Section({ title, icon, first = false, children }) {
  return (
    <section className={cx(panel, first ? 'mt-6' : 'mt-10')}>
      <div className={sectionHead}>
        <SectionHeading title={title} icon={icon} />
      </div>
      {children}
    </section>
  );
}

/** At the top, as a gallery: the photos say more about a kos at a glance than any list below them. */
function MediaSection({ survey }) {
  const groups = [
    { title: 'Room', noun: 'room photo', ids: survey.room?.photoIds },
    { title: 'Bathroom', noun: 'bathroom photo', ids: survey.bathroom?.photoIds },
    { title: 'Shared facilities', noun: 'shared facility photo', ids: survey.shared?.photoIds },
    { title: 'Videos', noun: 'video', ids: survey.additional?.videoIds, kind: 'video' },
  ].map((group) => ({ ...group, ids: group.ids ?? [] }));

  return (
    <section className="mb-6" aria-labelledby="media-title">
      <h2 className="sr-only" id="media-title">
        Photos and videos
      </h2>
      <MediaGallery groups={groups} />
    </section>
  );
}

function Fact({ label, children }) {
  return (
    <div>
      <span className={cx(narrowLabel, 'block text-muted')}>{label}</span>
      <span className="mt-1 block text-md font-semibold tabular-nums lining-nums">{children}</span>
    </div>
  );
}

export function SurveyDetailPage({ params: { id } }) {
  const { compareSelection } = useStore();
  const survey = store.findSurvey(id);
  if (!survey) {
    return (
      <NotFound
        title="That survey is not here"
        body="It may have been deleted, or the link may be wrong."
        backHref="#/surveys"
        backLabel="Back to my surveys"
      />
    );
  }

  const own = store.isOwnSurvey(id);
  const { kos, room, additional } = survey;

  // The breadcrumbs sit above the head, so its buttons centre on the name; a draft has no Add to compare.
  return (
    <>
      <Breadcrumbs
        trail={[own ? { label: 'My surveys', href: '#/surveys' } : { label: 'Community', href: '#/community' }]}
        current={kos.name}
      />
      <PageHead
        title={kos.name}
        lede={`${kos.kosLocation?.label ?? ''}${own ? '' : ` · Shared by ${survey.ownerName}`}`}
        actions={
          <>
            {store.canCompare(id) && (
              <button className={button({ className: 'max-lg:flex-1' })} type="button" onClick={() => toggleCompare(id, { go: !own })}>
                {compareSelection.includes(id) ? 'In comparison' : 'Add to compare'}
              </button>
            )}
            {own ? (
              <>
                <EditLink survey={survey} />
                <DeleteButton survey={survey} leaveTo="/surveys" />
              </>
            ) : (
              <>
                <StarButton survey={survey} starred={store.isStarred(id)} />
                <LikeButton survey={survey} liked={store.isLiked(id)} count={store.likeCount(id)} />
              </>
            )}
          </>
        }
      />

      <MediaSection survey={survey} />

      <div className={cx(panel, 'flex flex-wrap gap-6')} data-facts>
        <Fact label="Monthly rent">{numberToCurrency(kos.rent)}</Fact>
        <Fact label="Distance to campus">{formatKosDistance(kos)}</Fact>
        <Fact label="Room">{room.lengthM && room.widthM ? `${room.lengthM} × ${room.widthM} m` : 'Not recorded'}</Fact>
        {own && <Fact label="Status">{STATUS_LABELS[survey.status]}</Fact>}
      </div>

      <Section title="Kos information" icon="kos" first>
        <DefinitionList>
          <Definition label="Type" input={kosTypeLabel(kos.type)} />
          <Definition label="Address" input={kos.kosLocation?.address} />
          {!isValidPoint(kos.kosLocation) && <Definition label="Map" input={null} />}
          <Definition label="Campus" input={campusName(kos)} />
          <Definition label="Distance to campus" input={kos.distanceKm == null ? null : formatKosDistance(kos)} />
          <Definition label="Monthly rent" input={numberToCurrency(kos.rent)} />
          <Definition label="Owner or security phone" input={contact(kos.contactPhone)} />
        </DefinitionList>
        {isValidPoint(kos.kosLocation) && <MapView kos={kos.kosLocation} campus={kos.campusLocation} name={kos.name} />}
      </Section>

      <Section title="Room" icon="room">
        <DefinitionList>
          <Definition label="Cleanliness" input={likertLabel(room.cleanliness)} />
          <Definition label="Internet quality" input={likertLabel(room.internet)} />
        </DefinitionList>
        <Checklist all={ROOM_FACILITIES} selected={room.facilities} />
      </Section>

      <Section title="Bathroom" icon="bathroom">
        <DefinitionList>
          <Definition label="Bathroom type" input={choiceLabel(BATHROOM_TYPES, survey.bathroom.type)} />
          <Definition label="Toilet type" input={choiceLabel(TOILET_TYPES, survey.bathroom.toilet)} />
          <Definition label="Water heater" input={choiceLabel(YES_NO, survey.bathroom.waterHeater)} />
        </DefinitionList>
      </Section>
      <Section title="Shared facilities" icon="shared">
        <Checklist all={SHARED_FACILITIES} selected={survey.shared.facilities} />
      </Section>
      <Section title="Surroundings" icon="surroundings">
        <Checklist all={SURROUNDINGS} selected={survey.surroundings} />
      </Section>

      <Section title="Additional information" icon="additional">
        <DefinitionList>
          <Definition label="Security" input={likertLabel(additional.security)} />
        </DefinitionList>
        <p className="max-w-notes whitespace-pre-wrap" data-notes>
          <Value input={additional.notes} />
        </p>
      </Section>

    </>
  );
}
