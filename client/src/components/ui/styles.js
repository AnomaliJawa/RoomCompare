/** Class lists shared across components. Utilities that set the same property must never meet on one element. */

export const cx = (...parts) => parts.filter(Boolean).join(' ');

export const meta = 'text-xs text-muted';
export const unrecorded = 'text-muted italic';
export const numeric = 'tabular-nums lining-nums text-left';
/** The narrow face, for labels above figures. */
export const narrowLabel = 'font-narrow text-xs font-semibold';
export const panel = 'rounded-md border border-rule bg-surface p-6';
export const fieldLabel = 'text-xs font-medium text-muted';
export const fieldHint = 'text-xs text-muted';
export const fieldError = 'text-xs font-medium text-alert';

const VARIANTS = {
  primary:
    'border-transparent bg-accent text-surface hover:not-disabled:bg-accent-press hover:not-disabled:text-surface ' +
    'active:not-disabled:bg-accent-press active:not-disabled:text-surface',
  secondary:
    'border-rule bg-surface text-ink hover:not-disabled:border-accent hover:not-disabled:text-accent ' +
    'active:not-disabled:border-accent active:not-disabled:bg-accent-tint active:not-disabled:text-accent',
  quiet:
    'border-transparent bg-transparent text-accent hover:not-disabled:bg-accent-tint hover:not-disabled:text-accent-press ' +
    'active:not-disabled:bg-accent-tint active:not-disabled:text-accent-press',
  danger:
    'border-rule bg-surface text-alert hover:not-disabled:border-alert hover:not-disabled:bg-alert-bg ' +
    'hover:not-disabled:text-alert active:not-disabled:border-alert active:not-disabled:bg-alert-bg active:not-disabled:text-alert',
  /** Quiet, on the ink toast. */
  inverse:
    'border-transparent bg-transparent text-paper underline hover:not-disabled:bg-surface/12 hover:not-disabled:text-paper ' +
    'active:not-disabled:bg-surface/12 active:not-disabled:text-paper',
};

/** Every style restates its colour when pressed; every hover is gated to pointers that hover. */
export function button({
  variant = 'secondary',
  size = 'default',
  icon = false,
  gap = 'gap-2',
  display = 'inline-flex',
  padding = null,
  className = '',
} = {}) {
  const small = size === 'small';
  const quiet = variant === 'quiet' || variant === 'inverse';
  let space = 'px-4 py-2';
  if (icon) space = 'p-0';
  else if (small) space = 'px-3 py-1';
  else if (quiet) space = 'p-2';
  return cx(
    display,
    'items-center justify-center rounded-sm border font-semibold leading-[1.2]',
    'whitespace-nowrap no-underline transition-colors [-webkit-tap-highlight-color:transparent]',
    gap,
    padding ?? space,
    small ? 'min-h-8 text-xs touch-hit' : 'min-h-10 text-base pointer-coarse:min-h-target',
    icon && (small ? 'min-w-8' : 'min-w-10 pointer-coarse:min-w-target'),
    VARIANTS[variant],
    className,
  );
}

/** The input's own chrome; inside a group the wrapper draws it instead. */
export function control({ invalid = false, grouped = false, width = 'w-full', padding = 'px-3 py-2', className = '' } = {}) {
  if (grouped) {
    return cx(
      width,
      padding,
      'min-h-10 rounded-none border-0 bg-transparent focus-visible:outline-none',
      'pointer-coarse:min-h-[calc(var(--spacing-target)_-_2px)]',
      className,
    );
  }
  return cx(
    width,
    padding,
    'min-h-10 rounded-sm border bg-surface transition-[border-color] pointer-coarse:min-h-target',
    invalid ? 'border-alert' : 'border-rule hover:border-muted focus:border-accent',
    className,
  );
}

/** The wrapper of an affixed or combo field: it takes the border and the focus ring. */
export function controlGroup({ invalid = false, className = '' } = {}) {
  return cx(
    'flex items-stretch rounded-sm border bg-surface',
    'focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
    invalid ? 'border-alert' : 'border-rule hover:border-muted',
    className,
  );
}

/** The parts of a wide dialog: the head is where a phone sheet is dragged, so the browser must not claim it. */
export const dialogFrame = 'flex min-h-0 flex-col';
export const dialogHead = 'flex items-center justify-between gap-4 border-b border-rule px-6 py-4 max-lg:touch-none';
export const dialogBody = 'flex flex-col gap-6 overflow-y-auto overscroll-contain p-6';
export const dialogFoot = 'flex items-center justify-between gap-3 border-t border-rule bg-paper px-6 py-4';
/** On a phone the foot stacks, its buttons full width, clear of the home indicator. */
export const sheetFoot = 'max-lg:flex-col-reverse max-lg:pb-[max(1rem,env(safe-area-inset-bottom))] max-lg:[&>button]:w-full';
export const dialogTitle = 'text-md font-semibold';

/** A tick or radio in its own box; an invalid group's red border outranks the checked accent. */
export function choice({ checked = false, invalid = false, className = '' } = {}) {
  let border = 'border-rule hover:border-muted';
  if (invalid) border = 'border-alert';
  else if (checked) border = 'border-accent';
  return cx(
    'flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 pointer-coarse:min-h-target',
    'transition-[border-color,background-color] [-webkit-tap-highlight-color:transparent] [&_input]:accent-accent',
    border,
    checked ? 'bg-accent-tint' : 'bg-surface active:bg-accent-tint',
    className,
  );
}
