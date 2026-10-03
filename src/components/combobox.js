import { qs, qsa } from '../utils/dom.js';

/** Digits and one dot, a comma read as the dot: what the number field it replaced let through. */
export function cleanDecimal(text) {
  const [whole, ...rest] = text.replace(/,/g, '.').replace(/[^0-9.]/g, '').split('.');
  return rest.length ? `${whole}.${rest.join('')}` : whole;
}

function wire(combo) {
  const input = qs('[role="combobox"]', combo);
  const toggle = qs('[data-combo-toggle]', combo);
  const list = qs('[role="listbox"]', combo);
  const options = qsa('[role="option"]', list);
  let active = -1;

  const isOpen = () => !list.hidden;

  function markSelected() {
    const typed = input.value.trim() === '' ? Number.NaN : Number(input.value);
    for (const option of options) option.setAttribute('aria-selected', String(Number(option.dataset.value) === typed));
  }

  function setActive(index) {
    active = index;
    options.forEach((option, i) => option.classList.toggle('combo__option--active', i === index));
    if (index < 0) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    input.setAttribute('aria-activedescendant', options[index].id);
    options[index].scrollIntoView?.({ block: 'nearest' });
  }

  // A tap outside closes it even when the field never took focus, as on a phone opened from the chevron.
  const onOutside = (event) => {
    if (!combo.contains(event.target)) close();
  };

  function open(index) {
    if (!isOpen()) {
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', onOutside, true);
    }
    const selected = options.findIndex((option) => option.getAttribute('aria-selected') === 'true');
    setActive(index ?? (selected >= 0 ? selected : 0));
  }

  function close() {
    if (!isOpen()) return;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-expanded', 'false');
    setActive(-1);
    document.removeEventListener('pointerdown', onOutside, true);
  }

  function pick(option) {
    input.value = option.dataset.value;
    close();
    // As if typed and left: the dirty check hears the input, error repair the change.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  input.addEventListener('input', () => {
    const cleaned = cleanDecimal(input.value);
    if (cleaned !== input.value) {
      const caret = cleanDecimal(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
      input.value = cleaned;
      input.setSelectionRange(caret, caret);
    }
    markSelected();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (event.altKey) {
        if (event.key === 'ArrowDown') open();
        else close();
      } else if (!isOpen()) {
        open(event.key === 'ArrowUp' ? options.length - 1 : undefined);
      } else {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive(Math.min(options.length - 1, Math.max(0, active + step)));
      }
    } else if (event.key === 'Enter' && isOpen() && active >= 0) {
      event.preventDefault();
      pick(options[active]);
    } else if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      close();
    }
  });

  combo.addEventListener('focusout', (event) => {
    if (!combo.contains(event.relatedTarget)) close();
  });

  // Pressing the chevron or an option must not pull focus out of the field.
  toggle.addEventListener('mousedown', (event) => event.preventDefault());
  list.addEventListener('mousedown', (event) => event.preventDefault());

  toggle.addEventListener('click', () => (isOpen() ? close() : open()));

  list.addEventListener('click', (event) => {
    const option = event.target.closest('[role="option"]');
    if (option) pick(option);
  });

  return { close };
}

export function mountComboboxes(root) {
  const handles = qsa('[data-combo]', root).map(wire);
  return {
    destroy() {
      for (const handle of handles) handle.close();
    },
  };
}
