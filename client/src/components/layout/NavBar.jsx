import { Menu } from 'lucide-react';
import { logOut } from '../../actions/account.js';
import { button, cx } from '../ui/styles.js';

const LINKS = [
  { nav: 'surveys', href: '#/surveys', label: 'My surveys' },
  { nav: 'community', href: '#/community', label: 'Community' },
  { nav: 'compare', href: '#/compare', label: 'Compare' },
];

// On narrow screens the links drop down under the header, each marked by a rule on its left.
const link = cx(
  'h-full items-center border-b-2 border-transparent px-3 font-medium text-muted no-underline transition-colors',
  'hover:text-ink active:text-ink aria-[current=page]:border-b-accent aria-[current=page]:font-semibold aria-[current=page]:text-ink',
  'max-xl:h-auto max-xl:border-b-0 max-xl:border-l-2 max-xl:py-3 max-xl:pr-0 max-xl:pl-3 max-xl:aria-[current=page]:border-l-accent',
);

/**
 * The header: the wordmark alone until the session is known. Guests get the same links, and Log in
 * where Log out would be; Add survey sends them to log in. On phones it keeps one row: the logo,
 * Add survey and the menu icon.
 */
export function NavBar({ ready, user, auth, active, menuOpen, onToggleMenu }) {
  const who = user ? `Logged in as ${user.email}` : undefined;
  // On Log in and Register the page itself is the action.
  const actions = !auth;
  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper">
      <div className="mx-auto flex h-16 max-w-column-wide items-center gap-6 px-6 max-lg:px-4 max-md:gap-3 max-xs:gap-2">
        <a
          className="inline-flex items-center gap-2 text-md font-bold tracking-tight whitespace-nowrap text-ink no-underline pointer-coarse:min-h-target pointer-coarse:min-w-target"
          href={user ? '#/dashboard' : '#/community'}
        >
          <img className="block shrink-0" src="/icons/logo.svg" alt="" width="32" height="32" />
          {/* Phones show the logo alone; the hidden name keeps the link's name. */}
          <span className="max-lg:sr-only">RoomCompare</span>
        </a>

        {ready && (
          <>
            <nav
              className={cx(
                'flex h-full items-center gap-1',
                'max-xl:absolute max-xl:top-full max-xl:right-0 max-xl:left-0 max-xl:h-auto max-xl:flex-col max-xl:items-stretch',
                'max-xl:border-b max-xl:border-rule max-xl:bg-paper max-xl:px-6 max-xl:pt-2 max-xl:pb-4 max-lg:px-4',
                !menuOpen && 'max-xl:hidden',
              )}
              id="nav-links"
              aria-label="Primary"
              data-open={menuOpen ? 'true' : 'false'}
            >
              {LINKS.map((item) => (
                <a key={item.nav} className={cx('inline-flex', link)} href={item.href} aria-current={active === item.nav ? 'page' : undefined}>
                  {item.label}
                </a>
              ))}
              {/* On narrow screens Log out, or Log in, moves to the foot of the menu. */}
              {user ? (
                <button className={cx(link, 'hidden max-xl:flex')} type="button" title={who} onClick={logOut}>
                  Log out
                </button>
              ) : (
                actions && (
                  <a className={cx(link, 'hidden max-xl:flex')} href="#/login">
                    Log in
                  </a>
                )
              )}
            </nav>

            {/* Equal columns, so both actions take the wider label's width; the menu icon takes its own. */}
            <div className="ml-auto grid auto-cols-fr grid-flow-col items-center gap-2 pointer-coarse:gap-3 max-xl:auto-cols-auto">
              <button
                className={button({
                  variant: 'secondary',
                  display: 'hidden max-xl:inline-flex',
                  padding: 'p-2',
                  className:
                    'order-3 min-w-10 max-xl:pointer-coarse:min-w-target aria-expanded:border-accent aria-expanded:bg-accent-tint aria-expanded:text-accent',
                })}
                type="button"
                aria-controls="nav-links"
                aria-expanded={menuOpen ? 'true' : 'false'}
                aria-label="Menu"
                onClick={onToggleMenu}
              >
                <Menu size={20} strokeWidth={2} absoluteStrokeWidth className="block" />
              </button>
              {user ? (
                <button className={button({ variant: 'quiet', display: 'inline-flex max-xl:hidden' })} type="button" title={who} onClick={logOut}>
                  Log out
                </button>
              ) : (
                actions && (
                  <a className={button({ variant: 'quiet', display: 'inline-flex max-xl:hidden' })} href="#/login">
                    Log in
                  </a>
                )
              )}
              {/* A guest's goes through the route guard, which asks them to log in first. */}
              {actions && (
                <a className={button({ variant: 'primary', className: 'max-md:px-3' })} href="#/surveys/new">
                  Add survey
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
