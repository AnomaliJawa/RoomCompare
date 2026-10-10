import * as store from '../../data/store.js';
import { KOS_TYPES } from '../../constants.js';
import { useStore } from '../../hooks/useStore.js';
import { useDraftValue } from '../../hooks/useDebounced.js';
import { FACILITY_SECTIONS, activeFilterCount, facilityKey, filterCommunity } from '../../utils/filters.js';
import { CurrencyField, SelectField, TextField } from '../form/fields.jsx';
import { Modal, useCloseModal } from '../ui/Modal.jsx';
import {
  button,
  choice,
  cx,
  dialogBody,
  dialogFoot,
  dialogFrame,
  dialogHead,
  dialogTitle,
  meta,
  sheetFoot,
} from '../ui/styles.js';
import { msg, t } from '../../i18n/index.js';

export function FilterBar({ filters, total, showing, onOpen, openerRef }) {
  const active = activeFilterCount(filters);
  return (
    <div className="mb-16 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button ref={openerRef} className={button({ variant: 'secondary' })} type="button" aria-haspopup="dialog" onClick={onOpen}>
          {t('Filters')}
          {active > 0 && (
            <span className="ml-2 inline-grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 font-narrow text-xs text-surface tabular-nums lining-nums">
              {active}
            </span>
          )}
        </button>
        {active > 0 && (
          <button className={button({ variant: 'quiet' })} type="button" onClick={() => store.clearCommunityFilters()}>
            {t('Clear')}
          </button>
        )}
      </div>
      <p className={meta} role="status" aria-live="polite">
        {t('Showing {showing} of {total} shared surveys.', { showing, total })}
      </p>
    </div>
  );
}

const asDigits = (amount) => (amount === null ? '' : String(amount));

/** Filters apply as changed, so the count on Show updates while the dialog is open. */
function FilterContent() {
  const close = useCloseModal();
  const { communitySurveys, communityFilters: filters, starredIds } = useStore();
  const showing = filterCommunity(communitySurveys, filters, starredIds).length;
  const active = activeFilterCount(filters);
  const set = (key) => (value) => store.setCommunityFilter(key, value);
  const [location, setLocation] = useDraftValue(filters.location, set('location'));
  const [minRent, setMinRent] = useDraftValue(filters.minRent, set('minRent'));
  const [maxRent, setMaxRent] = useDraftValue(filters.maxRent, set('maxRent'));

  return (
    <div className={dialogFrame}>
      <div className={cx(dialogHead, 'filter-head')}>
        <h2 className={dialogTitle} id="filter-dialog-title">
          {t('Filters')}
        </h2>
        <button className={button({ variant: 'quiet', size: 'small' })} type="button" onClick={close}>
          {t('Close')}
        </button>
      </div>

      <div className={dialogBody}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] items-end gap-4">
          <TextField
            name="f-location"
            id="f-location"
            label={t('Location')}
            type="search"
            value={location}
            placeholder={t('e.g. Dinoyo')}
            onChange={setLocation}
          />
          <CurrencyField name="f-min" id="f-min" label={t('Rent from')} value={minRent} onChange={(amount) => setMinRent(asDigits(amount))} />
          <CurrencyField name="f-max" id="f-max" label={t('Rent up to')} value={maxRent} onChange={(amount) => setMaxRent(asDigits(amount))} />
          <SelectField
            name="f-type"
            id="f-type"
            label={t('Kos type')}
            value={filters.type}
            onChange={set('type')}
            options={[{ value: '', label: msg('All types') }, ...KOS_TYPES]}
          />
          <label className={choice({ checked: filters.starredOnly, className: 'min-h-10' })}>
            <input type="checkbox" checked={filters.starredOnly} onChange={(event) => store.setCommunityFilter('starredOnly', event.target.checked)} />
            {t('Starred only')}
          </label>
        </div>

        <div className="flex flex-col gap-4 border-t border-rule pt-4">
          <p className={meta}>{t('A kos must have every facility you pick.')}</p>
          {/* Scoped to their section: a room refrigerator is not a shared one. */}
          {FACILITY_SECTIONS.map(({ key, legend, options }) => (
            <fieldset key={key} className="m-0 border-0 p-0">
              <legend className="mb-3 p-0 text-xs font-medium text-muted">{t(legend)}</legend>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                {options.map((name) => {
                  const value = facilityKey(key, name);
                  const checked = filters.facilities.includes(value);
                  return (
                    <label key={value} className={choice({ checked })}>
                      <input type="checkbox" value={value} checked={checked} onChange={() => store.toggleCommunityFacility(value)} />
                      {t(name)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </div>

      <div className={cx(dialogFoot, sheetFoot)}>
        <button className={button({ variant: 'quiet' })} type="button" disabled={!active} onClick={() => store.clearCommunityFilters()}>
          {t('Clear all')}
        </button>
        <button className={button({ variant: 'primary' })} type="button" onClick={close}>
          {showing === 1 ? t('Show 1 survey') : t('Show {count} surveys', { count: showing })}
        </button>
      </div>
    </div>
  );
}

export function FilterDialog({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} kind="filters" sheetHandle=".filter-head" aria-labelledby="filter-dialog-title">
      <FilterContent />
    </Modal>
  );
}
