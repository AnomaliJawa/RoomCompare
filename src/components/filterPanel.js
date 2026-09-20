import { html, raw } from '../utils/dom.js';
import { textField, currencyField, selectField } from './fields.js';
import { KOS_TYPES, ROOM_FACILITIES, BATHROOM_FACILITIES, SHARED_FACILITIES } from '../constants.js';

/**
 * Filters for shared surveys.
 *
 * Facility requirements are scoped to their section, because the same word
 * means different things in different places: a Refrigerator in the room is
 * not a Refrigerator in a shared kitchen, and the requirement lists both.
 * A bare name would silently match either.
 *
 * Facilities sit inside a disclosure because there are 24 of them, and the
 * common case is filtering by rent or area.
 */

export const FACILITY_SECTIONS = [
  { key: 'room', legend: 'Room facilities', options: ROOM_FACILITIES },
  { key: 'bathroom', legend: 'Bathroom facilities', options: BATHROOM_FACILITIES },
  { key: 'shared', legend: 'Shared facilities', options: SHARED_FACILITIES },
];

export const facilityKey = (section, name) => `${section}:${name}`;

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

export function filterPanel(filters, { total, showing }) {
  const chosen = filters.facilities ?? [];
  const active =
    (filters.location ? 1 : 0) +
    (filters.minRent ? 1 : 0) +
    (filters.maxRent ? 1 : 0) +
    (filters.type ? 1 : 0) +
    (filters.starredOnly ? 1 : 0) +
    chosen.length;

  return html`
    <section class="panel section" aria-label="Filters">
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

      <details class="filter-facilities" ${chosen.length ? raw('open') : ''}>
        <summary class="filter-facilities__summary">
          <span>Facilities</span>
          <span class="meta">
            ${chosen.length ? `${chosen.length} required` : 'Any'}
          </span>
        </summary>
        <div class="filter-facilities__body">
          <p class="meta">A kos must have every facility you pick here.</p>
          ${FACILITY_SECTIONS.map((section) => facilityGroup(section, chosen))}
        </div>
      </details>

      <div class="filter-summary">
        <p class="meta">
          Showing ${showing} of ${total} shared surveys${active ? `, ${active} filter${active === 1 ? '' : 's'} applied` : ''}.
        </p>
        ${active
          ? raw(
              html`<button class="btn btn--quiet btn--small" type="button" data-action="clear-community-filters">
                Clear filters
              </button>`,
            )
          : ''}
      </div>
    </section>
  `;
}
