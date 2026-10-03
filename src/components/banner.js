import { html, raw } from '../utils/dom.js';

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

/** Said once at the top: "Not recorded" is easy to miss halfway down a long table. */
export function incompleteDataBanner(names) {
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return banner({
    message: `Some information is missing for ${list}. Rows below read “Not recorded” where nothing was captured.`,
  });
}
