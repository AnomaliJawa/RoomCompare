/**
 * Delegated event bridge.
 *
 * One listener per event type on the document, dispatching on `data-action`.
 * This is the prototype's pattern (script.js:581) kept deliberately: it
 * survives re-renders without rebinding, which matters when a view replaces
 * its own markup on every store change.
 */

const clickHandlers = new Map();
const inputHandlers = new Map();
const changeHandlers = new Map();
const submitHandlers = new Map();

const registries = {
  click: clickHandlers,
  input: inputHandlers,
  change: changeHandlers,
  submit: submitHandlers,
};

/** Register a handler for `data-action="name"`. */
export function onAction(name, handler, type = 'click') {
  const registry = registries[type];
  if (!registry) throw new Error(`Unsupported delegated event type: ${type}`);
  registry.set(name, handler);
}

export function offAction(name, type = 'click') {
  registries[type]?.delete(name);
}

function dispatch(registry, event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const handler = registry.get(target.dataset.action);
  if (!handler) return;
  handler({ target, dataset: target.dataset, event });
}

export function startEventBridge() {
  document.addEventListener('click', (event) => dispatch(clickHandlers, event));
  document.addEventListener('input', (event) => dispatch(inputHandlers, event));
  document.addEventListener('change', (event) => dispatch(changeHandlers, event));
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-action]');
    if (!form) return;
    const handler = submitHandlers.get(form.dataset.action);
    if (!handler) return;
    event.preventDefault();
    handler({ target: form, dataset: form.dataset, event });
  });
}
