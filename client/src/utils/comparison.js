import { numberToCurrency, formatKosDistance } from './format.js';
import {
  ROOM_FACILITIES,
  BATHROOM_TYPES,
  TOILET_TYPES,
  YES_NO,
  SHARED_FACILITIES,
  SURROUNDINGS,
  COMPARISON_GROUPS,
  choiceLabel,
  likertLabel,
  kosTypeLabel,
} from '../constants.js';

/** Never truncated: every facility row gets an explicit ✓ or —. */

export const MISSING = Symbol('missing');

/** prose: notes keep their line breaks and sit under the kos name on narrow screens. */
function textRow(label, values, { best = null, prose = false } = {}) {
  return { kind: 'text', label, values, best, prose };
}

function facilityRows(all, pick) {
  return all.map((item) => ({
    kind: 'facility',
    label: item,
    values: pick.map((list) => (list ?? []).includes(item)),
    best: null,
  }));
}

function lowestIndex(numbers) {
  let best = null;
  numbers.forEach((n, i) => {
    if (!Number.isFinite(n)) return;
    if (best === null || n < numbers[best]) best = i;
  });
  const finite = numbers.filter(Number.isFinite);
  if (finite.length < 2 || new Set(finite).size === 1) return null;
  return best;
}

export function buildGroups(surveys) {
  const rents = surveys.map((s) => s.kos.rent ?? NaN);
  const distances = surveys.map((s) => s.kos.distanceKm ?? NaN);

  // No Status row: draft or published describes the record, not the kos.
  const rows = {
    kos: [
      textRow('Type', surveys.map((s) => kosTypeLabel(s.kos.type) ?? MISSING)),
      textRow('Location', surveys.map((s) => s.kos.kosLocation?.label ?? MISSING)),
      textRow('Monthly rent', surveys.map((s) => (s.kos.rent == null ? MISSING : numberToCurrency(s.kos.rent))), {
        best: lowestIndex(rents),
      }),
      textRow(
        'Distance to campus',
        surveys.map((s) => (s.kos.distanceKm == null ? MISSING : formatKosDistance(s.kos))),
        { best: lowestIndex(distances) },
      ),
    ],
    room: [
      textRow(
        'Dimensions',
        surveys.map((s) => (s.room.lengthM && s.room.widthM ? `${s.room.lengthM} × ${s.room.widthM} m` : MISSING)),
      ),
      textRow(
        'Floor area',
        surveys.map((s) =>
          s.room.lengthM && s.room.widthM ? `${(s.room.lengthM * s.room.widthM).toFixed(1)} m²` : MISSING,
        ),
      ),
      textRow('Cleanliness', surveys.map((s) => likertLabel(s.room.cleanliness) ?? MISSING)),
      textRow('Internet quality', surveys.map((s) => likertLabel(s.room.internet) ?? MISSING)),
      ...facilityRows(ROOM_FACILITIES, surveys.map((s) => s.room.facilities)),
    ],
    bathroom: [
      textRow('Bathroom type', surveys.map((s) => choiceLabel(BATHROOM_TYPES, s.bathroom?.type) ?? MISSING)),
      textRow('Toilet type', surveys.map((s) => choiceLabel(TOILET_TYPES, s.bathroom?.toilet) ?? MISSING)),
      textRow('Water heater', surveys.map((s) => choiceLabel(YES_NO, s.bathroom?.waterHeater) ?? MISSING)),
    ],
    shared: facilityRows(SHARED_FACILITIES, surveys.map((s) => s.shared.facilities)),
    surroundings: facilityRows(SURROUNDINGS, surveys.map((s) => s.surroundings)),
    additional: [
      textRow('Security', surveys.map((s) => likertLabel(s.additional.security) ?? MISSING)),
      textRow('Notes', surveys.map((s) => s.additional.notes || MISSING), { prose: true }),
      textRow(
        'Photos recorded',
        surveys.map((s) => {
          const count =
            (s.room.photoIds?.length ?? 0) +
            (s.bathroom.photoIds?.length ?? 0) +
            (s.shared.photoIds?.length ?? 0);
          return count === 0 ? 'None' : String(count);
        }),
      ),
    ],
  };
  return COMPARISON_GROUPS.map(({ key, label }) => ({ label, rows: rows[key] }));
}

/** Leads the comparison when scores are passed; the panel under it shows how each total is reached. */
export function scoreGroup(scores) {
  return {
    label: 'Best Match score',
    rows: [{ kind: 'score', label: 'Score', values: scores.map((score) => score.total), scores, best: null }],
  };
}

export function rowDiffers(row) {
  // Identity comparison, so "not recorded" never equals a value that stringifies alike.
  const [first, ...rest] = row.values;
  return rest.some((value) => value !== first);
}
