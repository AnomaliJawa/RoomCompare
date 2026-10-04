import { Heart, Pencil, Star, Trash2 } from 'lucide-react';
import { askDelete, toggleLike, toggleStar } from '../../actions/surveys.js';
import { ICON } from '../ui/icons.js';
import { button, cx } from '../ui/styles.js';

/** Icon buttons are named for their kos, since an icon says nothing to a screen reader. */

/** The name stays "Star" and aria-pressed carries the state; the icon fills from it. */
export function StarButton({ survey, starred, small = false, className = '' }) {
  return (
    <button
      className={button({ variant: small ? 'quiet' : 'secondary', size: small ? 'small' : 'default', icon: true, className: cx('group', className) })}
      type="button"
      aria-label={`Star ${survey.kos.name}`}
      aria-pressed={starred ? 'true' : 'false'}
      onClick={() => toggleStar(survey.id)}
    >
      <Star {...ICON} className="block group-aria-pressed:fill-star group-aria-pressed:stroke-star" />
    </button>
  );
}

/** The count sits inside the button, so its name reads "Like Kos Kartika, 24 likes". */
export function LikeButton({ survey, liked, count, small = false }) {
  return (
    <button
      className={button({
        variant: small ? 'quiet' : 'secondary',
        size: small ? 'small' : 'default',
        gap: 'gap-1',
        className: 'group tabular-nums lining-nums aria-pressed:text-accent',
      })}
      type="button"
      aria-pressed={liked ? 'true' : 'false'}
      onClick={() => toggleLike(survey.id)}
    >
      <Heart {...ICON} className="block group-aria-pressed:fill-current" />
      <span className="sr-only">Like {survey.kos.name}, </span>
      <span data-like-count>{count}</span>
      <span className="sr-only"> {count === 1 ? 'like' : 'likes'}</span>
    </button>
  );
}

export function EditLink({ survey, small = false, className = '' }) {
  return (
    <a
      className={button({ variant: 'secondary', size: small ? 'small' : 'default', icon: true, className })}
      href={`#/surveys/${survey.id}/edit`}
      aria-label={`Edit ${survey.kos.name}`}
    >
      <Pencil {...ICON} />
    </a>
  );
}

export function DeleteButton({ survey, small = false, leaveTo = null }) {
  return (
    <button
      className={button({ variant: 'danger', size: small ? 'small' : 'default', icon: true })}
      type="button"
      aria-label={`Delete ${survey.kos.name}`}
      onClick={() => askDelete(survey.id, { leaveTo })}
    >
      <Trash2 {...ICON} />
    </button>
  );
}
