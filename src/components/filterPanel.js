import { html, raw } from '../utils/dom.js';
import { textField, currencyField, selectField } from './fields.js';
import { KOS_TYPES, ROOM_FACILITIES, BATHROOM_FACILITIES, SHARED_FACILITIES } from '../constants.js';

/** Facility filters are scoped to their section: a room refrigerator is not a shared one. */

export const FACILITY_SECTIONS = [
  { key: 'room', legend: 'Room facilities', options: ROOM_FACILITIES },
  { key: 'bathroom', legend: 'Bathroom facilities', options: BATHROOM_FACILITIES },
  { key: 'shared', legend: 'Shared facilities', options: SHARED_FACILITIES },
];

export const facilityKey = (section, name) => `${section}:${name}`;

export function activeFilterCount(filters) {
  return (
    (filters.location ? 1 : 0) +
    (filters.minRent ? 1 : 0) +
    (filters.maxRent ? 1 : 0) +
    (filters.type ? 1 : 0) +
    (filters.starredOnly ? 1 : 0) +
    (filters.facilities?.length ?? 0)
  );
}

export function filterBar(filters, { total, showing }) {
  const active = activeFilterCount(filters);

  return html`
    <div class="filter-bar">
      <div class="filter-bar__actions">
        <button class="btn btn--secondary" type="button" data-action="open-filters" aria-haspopup="dialog">
          Filters${active ? html`<span class="filter-bar__count">${active}</span>` : ''}
        </button>
        ${active
          ? raw(
              html`<button class="btn btn--quiet" type="button" data-action="clear-community-filters">
                Clear
              </button>`,
            )
          : ''}
      </div>
      <p class="meta" role="status" aria-live="polite">
        Showing ${showing} of ${total} shared surveys.
      </p>
    </div>
  `;
}

function facilityGroup({ key, legend, options }, selected) {
  return html`
    <fieldset class="choice-group">
      <legend class="choice-group__legend">${legend}</legend>
      <div class="choice-group__options">
        ${options.map((name) => {
          const value = facilityKey(key, name);
          return html`<label class="choice">
            <input
              type="checkbox"
              value="${value}"
              data-action="filter-facility"
              ${selected.includes(value) ? raw('checked') : ''}
            />
            ${name}
          </label>`;
        })}
      </div>
    </fieldset>
  `;
}

export function filterDialogContent(filters, { total, showing }) {
  const chosen = filters.facilities ?? [];
  const active = activeFilterCount(filters);

  return html`
    <div class="filter-dialog">
      <div class="filter-dialog__head">
        <h2 class="dialog__title" id="filter-dialog-title">Filters</h2>
        <button class="btn btn--quiet btn--small" type="button" data-action="close-filters">Close</button>
      </div>

      <div class="filter-dialog__body">
        <div class="filter-grid">
          ${textField({
            name: 'f-location',
            id: 'f-location',
            label: 'Location',
            type: 'search',
            value: filters.location,
            placeholder: 'e.g. Dinoyo',
            action: 'filter-location',
          })}
          ${currencyField({ name: 'f-min', id: 'f-min', label: 'Rent from', value: filters.minRent, action: 'filter-min-rent' })}
          ${currencyField({ name: 'f-max', id: 'f-max', label: 'Rent up to', value: filters.maxRent, action: 'filter-max-rent' })}
          ${selectField({
            name: 'f-type',
            id: 'f-type',
            label: 'Kos type',
            value: filters.type,
            action: 'filter-type',
            options: [{ value: '', label: 'All types' }, ...KOS_TYPES],
          })}
          <label class="choice filter-grid__star">
            <input type="checkbox" data-action="filter-starred" ${filters.starredOnly ? raw('checked') : ''} />
            Starred only
          </label>
        </div>

        <div class="filter-dialog__facilities">
          <p class="meta">A kos must have every facility you pick.</p>
          ${FACILITY_SECTIONS.map((section) => facilityGroup(section, chosen))}
        </div>
      </div>

      <div class="filter-dialog__foot">
        <button
          class="btn btn--quiet"
          type="button"
          data-action="clear-community-filters"
          ${active ? '' : raw('disabled')}
        >Clear all</button>
        <button class="btn btn--primary" type="button" data-action="close-filters">
          Show ${showing} ${showing === 1 ? 'survey' : 'surveys'}
        </button>
      </div>
    </div>
  `;
}
