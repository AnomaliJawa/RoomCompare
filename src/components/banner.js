import { html, raw } from '../utils/dom.js';

/**
 * A line of context above the content: something failed, something is
 * incomplete, something is off.
 *
 * Banners explain and offer a way forward. They never apologise and they are
 * never vague about what happened, because the user has to decide what to do
 * about it.
 */

export function banner({ message, tone = 'info', action = null }) {
  return html`
    <div class="banner" data-tone="${tone}">
      <span>${message}</span>
      ${action
        ? raw(
            html`<button class="btn btn--quiet btn--small" type="button" data-action="${action.name}">
              ${action.label}
            </button>`,
          )
        : ''}
    </div>
  `;
}

/**
 * Comparison rows read "Not recorded" wherever nothing was captured, but that
 * is easy to miss halfway down a long table, so it is said once at the top.
 */
export function incompleteDataBanner(names) {
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return banner({
    message: `Some information is missing for ${list}. Rows below read “Not recorded” where nothing was captured.`,
  });
}
