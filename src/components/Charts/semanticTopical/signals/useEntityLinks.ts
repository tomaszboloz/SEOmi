import { useCallback, useMemo, useRef, useState } from 'react';
import { entityGaps, linkEntity, lookupWikidata, overrideKey, type LanguageTopic, type WikidataLookup } from '@/services/entityIds';
import { lookupKey, parseOverride, readEntityStore, writeEntityStore, type EntityStore } from '@/services/entityIds/store';

export type EntityLookupFn = (label: string, language: string) => Promise<WikidataLookup>;
/** Topics looked up per click; keeps a run short and polite to the public API. */
export const MAX_LOOKUPS_PER_RUN = 40;

/** Wikidata entity links for the language versions of a crawl (#99): explicit user action, cached per project. */
export const useEntityLinks = (projectId: string | null, topics: LanguageTopic[], lookup: EntityLookupFn = lookupWikidata) => {
  const [store, setStore] = useState<EntityStore>(() => readEntityStore(projectId));
  const [scope, setScope] = useState(projectId);
  const [running, setRunning] = useState(false);
  const run = useRef(0);
  if (scope !== projectId) { setScope(projectId); setStore(readEntityStore(projectId)); setRunning(false); run.current += 1; }
  const save = useCallback((next: EntityStore) => { setStore(next); if (projectId) writeEntityStore(projectId, next); }, [projectId]);
  const pending = useMemo(() => topics.filter((topic) => !(lookupKey(topic.language, topic.label) in store.lookups)), [topics, store]);

  const match = useCallback(async () => {
    const own = ++run.current;
    setRunning(true);
    let next = store;
    for (const topic of pending.slice(0, MAX_LOOKUPS_PER_RUN)) {
      const result = await lookup(topic.label, topic.language);
      if (run.current !== own) return;
      next = { ...next, lookups: { ...next.lookups, [lookupKey(topic.language, topic.label)]: result } };
      save(next);
    }
    setRunning(false);
  }, [store, pending, lookup, save]);

  const correct = useCallback((topic: LanguageTopic, input: string) => {
    const value = parseOverride(input);
    const overrides = { ...store.overrides };
    if (value === undefined) delete overrides[overrideKey(topic.language, topic.topic)];
    else overrides[overrideKey(topic.language, topic.topic)] = value;
    save({ ...store, overrides });
  }, [store, save]);

  const links = useMemo(() => topics.map((topic) => linkEntity(topic, store.lookups[lookupKey(topic.language, topic.label)], store.overrides)), [topics, store]);
  const languages = useMemo(() => [...new Set(topics.map((topic) => topic.language))].sort(), [topics]);
  const gaps = useMemo(() => (languages.length > 1 ? entityGaps(links, languages) : []), [links, languages]);
  return { links, gaps, pending: pending.length, running, match, correct };
};
