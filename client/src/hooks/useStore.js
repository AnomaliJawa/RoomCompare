import { useSyncExternalStore } from 'react';
import * as store from '../data/store.js';

/** Re-renders on every store change, as the app's views always did, and hands back the state. */
export function useStore() {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store.getState();
}
