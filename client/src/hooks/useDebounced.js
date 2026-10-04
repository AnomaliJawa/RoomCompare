import { useCallback, useEffect, useRef, useState } from 'react';

/** Calls the latest `fn` once typing pauses for `wait` ms; cancelled on unmount. */
export function useDebouncedCallback(fn, wait = 200) {
  const timer = useRef(null);
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback(
    (...args) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current(...args), wait);
    },
    [wait],
  );
}

/**
 * A field typed locally and sent to the store after a pause, so a keystroke never waits on a
 * re-render; a change made elsewhere, such as Clear, comes back into the field.
 */
export function useDraftValue(stored, commit, wait = 200) {
  const [draft, setDraft] = useState(stored);
  const send = useDebouncedCallback(commit, wait);
  useEffect(() => setDraft(stored), [stored]);
  const change = (value) => {
    setDraft(value);
    send(value);
  };
  return [draft, change];
}
