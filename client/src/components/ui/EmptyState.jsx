import * as store from '../../data/store.js';
import { button } from './styles.js';

/** `actions`: a link ({ label, href }) or a button ({ label, onClick }); `children` follow the body as they are. */
export function EmptyState({ title, body, actions = [], className = '', children = null }) {
  return (
    <section className={`rounded-md border border-dashed border-rule bg-surface px-6 py-10 text-left ${className}`}>
      <p className="text-md font-semibold">{title}</p>
      <p className="mt-2 mb-4 text-muted">{body}</p>
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) =>
            action.href ? (
              <a key={action.label} className={button({ variant: 'primary' })} href={action.href}>
                {action.label}
              </a>
            ) : (
              <button key={action.label} className={button({ variant: 'secondary' })} type="button" onClick={action.onClick}>
                {action.label}
              </button>
            ),
          )}
        </div>
      )}
      {children}
    </section>
  );
}

export const NoSurveysYet = () => (
  <EmptyState
    title="No kos recorded yet"
    body="Use Add survey at the top to record the first kos you visited. Once two are published, you can compare them side by side."
  />
);

export const NoSearchResults = ({ query, onClear }) => (
  <EmptyState
    title={`No surveys match “${query}”`}
    body="Check the spelling, or clear the search to see everything."
    actions={[{ label: 'Clear search', onClick: onClear }]}
  />
);

export const NoFilterResults = () => (
  <EmptyState
    title="No shared surveys match these filters"
    body="Widen the rent range or clear the filters to see everything."
    actions={[{ label: 'Clear filters', onClick: () => store.clearCommunityFilters() }]}
  />
);

export const NothingSelected = () => (
  <EmptyState
    title="Add two kos to start comparing"
    body={
      'Choose an empty slot above to pick from your published surveys and the community’s. ' +
      'You can compare up to three at once.'
    }
  />
);

export const NeedsOneMore = ({ name }) => (
  <EmptyState
    title="Add one more kos"
    body={`A comparison needs at least two. ${name} is ready to go; choose an empty slot above to pick another.`}
    actions={[{ label: 'Add survey', href: '#/surveys/new' }]}
  />
);

export const NotFound = ({ title, body, backHref, backLabel }) => (
  <EmptyState title={title} body={body} actions={[{ label: backLabel, href: backHref }]} />
);
