import { Bath, BedDouble, Camera, FileText, House, MapPin, Users } from 'lucide-react';
import { SECTION_ICON } from './icons.js';

const ICONS = {
  kos: House,
  room: BedDouble,
  bathroom: Bath,
  shared: Users,
  surroundings: MapPin,
  additional: FileText,
  media: Camera,
};

/** Decorative: the heading's words name the section. The icon centres on its first line. */
export function SectionHeading({ title, icon, id }) {
  const Icon = ICONS[icon];
  return (
    <h2 className="flex items-baseline gap-2" id={id}>
      <span className="mt-[calc((1lh_-_24px)/2)] shrink-0 self-start text-accent" aria-hidden="true" data-section-icon={icon}>
        <Icon {...SECTION_ICON} className="block" />
      </span>
      <span>{title}</span>
    </h2>
  );
}

/** On a phone the photo count moves under the heading rather than wrapping. */
export const sectionHead = 'mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-3';
