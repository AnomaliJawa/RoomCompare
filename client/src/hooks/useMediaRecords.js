import { useEffect, useRef, useState } from 'react';
import { loadMedia } from '../data/media.js';
import { releaseUrl, urlFor } from '../data/mediaDb.js';

/**
 * The files behind these ids, each with an object URL, in the order asked. Ids this device does not
 * hold are absent from `records`. Each URL pins its blob in memory, so it is released once its id
 * leaves the list or the component unmounts; ids already loaded are not loaded again.
 */
export function useMediaRecords(ids) {
  const key = ids.join(',');
  const held = useRef(new Map());
  const [loadedKey, setLoadedKey] = useState(null);

  useEffect(() => {
    let live = true;
    const wanted = key ? key.split(',') : [];
    for (const id of [...held.current.keys()]) {
      if (wanted.includes(id)) continue;
      releaseUrl(id);
      held.current.delete(id);
    }
    const missing = wanted.filter((id) => !held.current.has(id));
    if (!missing.length) {
      setLoadedKey(key);
      return undefined;
    }
    loadMedia(missing).then((records) => {
      if (!live) return;
      for (const record of records) held.current.set(record.id, { ...record, url: urlFor(record) });
      setLoadedKey(key);
    });
    return () => {
      live = false;
    };
  }, [key]);

  useEffect(
    () => () => {
      held.current.forEach((_, id) => releaseUrl(id));
      held.current.clear();
    },
    [],
  );

  return {
    ready: loadedKey === key,
    records: ids.map((id) => held.current.get(id)).filter(Boolean),
  };
}
