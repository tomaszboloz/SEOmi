import { useTranslation } from 'react-i18next';
import type { HelpContent, HelpId } from './helpTypes';

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

/** Reads `help.<id>` for the active language. Returns null (never throws) when absent or incomplete. */
export const useHelp = (id: HelpId): HelpContent | null => {
  const { t } = useTranslation();
  const key = `help.${id}`;
  const raw: unknown = t(key, { returnObjects: true });
  const entry = raw as Partial<Record<keyof HelpContent, unknown>> | null;
  if (!entry || typeof entry !== 'object' || ![entry.title, entry.what, entry.why, entry.action].every(isText)) {
    if (import.meta.env.DEV && import.meta.env.MODE !== 'test') console.warn(`[help] missing or incomplete help entry "${key}"`);
    return null;
  }
  return {
    title: entry.title as string,
    what: entry.what as string,
    why: entry.why as string,
    action: entry.action as string,
    example: isText(entry.example) ? entry.example : undefined,
    learnMore: isText(entry.learnMore) ? entry.learnMore : undefined,
  };
};
