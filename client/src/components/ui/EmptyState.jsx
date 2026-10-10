import * as store from '../../data/store.js';
import { button } from './styles.js';
import { msg, t } from '../../i18n/index.js';

/**
 * `actions`: a link ({ label, href }, primary) or a button ({ label, onClick }, secondary), either with its
 * own `variant`; `children` follow the body as they are.
 */
export function EmptyState({ title, body, actions = [], className = '', children = null }) {
  return (
    <section className={`rounded-md border border-dashed border-rule bg-surface px-6 py-10 text-left ${className}`}>
      <p className="text-md font-semibold">{t(title)}</p>
      <p className="mt-2 mb-4 text-muted">{t(body)}</p>
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) =>
            action.href ? (
              <a key={action.label} className={button({ variant: action.variant ?? 'primary' })} href={action.href}>
                {t(action.label)}
              </a>
            ) : (
              <button key={action.label} className={button({ variant: action.variant ?? 'secondary' })} type="button" onClick={action.onClick}>
                {t(action.label)}
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
    title={msg('No kos recorded yet')}
    body={msg('Use Add survey at the top to record the first kos you visited. Once two are published, you can compare them side by side.')}
  />
);

const ACCOUNT_ACTIONS = [
  { label: msg('Log in'), href: '#/login' },
  { label: msg('Create account'), href: '#/register', variant: 'secondary' },
];

export const GuestSurveys = () => (
  <EmptyState
    title={msg('Log in to keep your surveys')}
    body={msg('The kos you record are kept in your account, there on any device you log in from. Until then, Community shows kos other students have surveyed.')}
    actions={ACCOUNT_ACTIONS}
  />
);

export const GuestCompare = () => (
  <EmptyState
    title={msg('Log in to compare kos')}
    body={msg('Compare sets up to three kos side by side, your own published surveys and the community’s, on the same criteria. It needs an account.')}
    actions={ACCOUNT_ACTIONS}
  />
);

export const NoSearchResults = ({ query, onClear }) => (
  <EmptyState
    title={t('No surveys match “{query}”', { query })}
    body={msg('Check the spelling, or clear the search to see everything.')}
    actions={[{ label: msg('Clear search'), onClick: onClear }]}
  />
);

export const NoFilterResults = () => (
  <EmptyState
    title={msg('No shared surveys match these filters')}
    body={msg('Widen the rent range or clear the filters to see everything.')}
    actions={[{ label: msg('Clear filters'), onClick: () => store.clearCommunityFilters() }]}
  />
);

export const NothingSelected = () => (
  <EmptyState
    title={msg('Add two kos to start comparing')}
    body={msg('Choose an empty slot above to pick from your published surveys and the community’s. You can compare up to three at once.')}
  />
);

export const NeedsOneMore = ({ name }) => (
  <EmptyState
    title={msg('Add one more kos')}
    body={t('A comparison needs at least two. {name} is ready to go; choose an empty slot above to pick another.', { name })}
    actions={[{ label: msg('Add survey'), href: '#/surveys/new' }]}
  />
);

export const NotFound = ({ title, body, backHref, backLabel }) => (
  <EmptyState title={title} body={body} actions={[{ label: backLabel, href: backHref }]} />
);
