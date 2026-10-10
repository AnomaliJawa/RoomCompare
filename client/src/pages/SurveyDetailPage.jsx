import * as store from '../data/store.js';
import { useStore } from '../hooks/useStore.js';
import { toggleCompare } from '../actions/surveys.js';
import {
  BATHROOM_TYPES,
  ROOM_FACILITIES,
  SHARED_FACILITIES,
  SURROUNDINGS,
  TOILET_TYPES,
  YES_NO,
  choiceLabel,
  kosTypeLabel,
  likertLabel,
  statusLabel,
} from '../constants.js';
import { msg, t } from '../i18n/index.js';
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
  if (input === null || input === undefined || input === '') return <span className={unrecorded}>{t('Not recorded')}</span>;
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
    // 220: the longest item, "Chinese temple (klenteng)", stays on one line beside its mark.
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-x-4 gap-y-2">
      {all.map((item) => {
        const present = chosen.has(item);
        return (
          <li key={item} className={cx('flex items-baseline gap-2', present ? 'text-ink' : 'text-muted')} data-present={present}>
            <span className={cx('w-[1em] font-semibold', present ? 'text-accent' : 'text-muted')} aria-hidden="true" data-mark>
              {present ? '✓' : '✗'}
            </span>
            <span>{t(item)}</span>
            <span className="sr-only">{present ? t('present') : t('not available')}</span>
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
    { title: msg('Room'), one: msg('1 room photo'), many: msg('{count} room photos'), none: msg('room photos'), ids: survey.room?.photoIds },
    {
      title: msg('Bathroom'),
      one: msg('1 bathroom photo'),
      many: msg('{count} bathroom photos'),
      none: msg('bathroom photos'),
      ids: survey.bathroom?.photoIds,
    },
    {
      title: msg('Shared facilities'),
      one: msg('1 shared facility photo'),
      many: msg('{count} shared facility photos'),
      none: msg('shared facility photos'),
      ids: survey.shared?.photoIds,
    },
    { title: msg('Videos'), one: msg('1 video'), many: msg('{count} videos'), ids: survey.additional?.videoIds, kind: 'video' },
  ].map((group) => ({ ...group, ids: group.ids ?? [] }));

  return (
    <section className="mb-6" aria-labelledby="media-title">
      <h2 className="sr-only" id="media-title">
        {t('Photos and videos')}
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
        title={msg('That survey is not here')}
        body={msg('It may have been deleted, or the link may be wrong.')}
        backHref="#/surveys"
        backLabel={msg('Back to my surveys')}
      />
    );
  }

  const own = store.isOwnSurvey(id);
  const { kos, room, additional } = survey;

  // The breadcrumbs sit above the head, so its buttons centre on the name; a draft has no Add to compare.
  return (
    <>
      <Breadcrumbs
        trail={[own ? { label: msg('My surveys'), href: '#/surveys' } : { label: msg('Community'), href: '#/community' }]}
        current={kos.name}
      />
      <PageHead
        title={kos.name}
        lede={own ? kos.kosLocation?.label ?? '' : t('{area} · Shared by {name}', { area: kos.kosLocation?.label ?? '', name: survey.ownerName })}
        actions={
          <>
            {store.canCompare(id) && (
              <button className={button({ className: 'max-lg:flex-1' })} type="button" onClick={() => toggleCompare(id, { go: !own })}>
                {compareSelection.includes(id) ? t('In comparison') : t('Add to compare')}
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
        <Fact label={t('Monthly rent')}>{numberToCurrency(kos.rent)}</Fact>
        <Fact label={t('Distance to campus')}>{formatKosDistance(kos)}</Fact>
        <Fact label={t('Room')}>{room.lengthM && room.widthM ? `${room.lengthM} × ${room.widthM} m` : t('Not recorded')}</Fact>
        {own && <Fact label={t('Status')}>{statusLabel(survey.status)}</Fact>}
      </div>

      <Section title={t('Kos information')} icon="kos" first>
        <DefinitionList>
          <Definition label={t('Type')} input={kosTypeLabel(kos.type)} />
          <Definition label={t('Address')} input={kos.kosLocation?.address} />
          {!isValidPoint(kos.kosLocation) && <Definition label={t('Map')} input={null} />}
          <Definition label={t('Campus')} input={campusName(kos)} />
          <Definition label={t('Distance to campus')} input={kos.distanceKm == null ? null : formatKosDistance(kos)} />
          <Definition label={t('Monthly rent')} input={numberToCurrency(kos.rent)} />
          <Definition label={t('Owner or security phone')} input={contact(kos.contactPhone)} />
        </DefinitionList>
        {isValidPoint(kos.kosLocation) && <MapView kos={kos.kosLocation} campus={kos.campusLocation} name={kos.name} />}
      </Section>

      <Section title={t('Room')} icon="room">
        <DefinitionList>
          <Definition label={t('Cleanliness')} input={likertLabel(room.cleanliness)} />
          <Definition label={t('Internet quality')} input={likertLabel(room.internet)} />
        </DefinitionList>
        <Checklist all={ROOM_FACILITIES} selected={room.facilities} />
      </Section>

      <Section title={t('Bathroom')} icon="bathroom">
        <DefinitionList>
          <Definition label={t('Bathroom type')} input={choiceLabel(BATHROOM_TYPES, survey.bathroom.type)} />
          <Definition label={t('Toilet type')} input={choiceLabel(TOILET_TYPES, survey.bathroom.toilet)} />
          <Definition label={t('Water heater')} input={choiceLabel(YES_NO, survey.bathroom.waterHeater)} />
        </DefinitionList>
      </Section>
      <Section title={t('Shared facilities')} icon="shared">
        <Checklist all={SHARED_FACILITIES} selected={survey.shared.facilities} />
      </Section>
      <Section title={t('Surroundings')} icon="surroundings">
        <Checklist all={SURROUNDINGS} selected={survey.surroundings} />
      </Section>

      <Section title={t('Additional information')} icon="additional">
        <DefinitionList>
          <Definition label={t('Security')} input={likertLabel(additional.security)} />
        </DefinitionList>
        <p className="max-w-notes whitespace-pre-wrap" data-notes>
          <Value input={store.notesOf(survey)} />
        </p>
      </Section>

    </>
  );
}
