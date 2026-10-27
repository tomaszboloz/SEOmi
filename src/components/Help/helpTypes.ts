import type en from '@/i18n/locales/en.json';

/** Shape of one help entry stored under `help.<area>.<id>` in every locale. */
export interface HelpContent {
  title: string;
  what: string;
  why: string;
  /** One step per line (`\n`). Several lines render as a numbered list. */
  action: string;
  example?: string;
  learnMore?: string;
}

type HelpTree = typeof en.help;

/** Every `<area>.<id>` that exists in en.json. Add the English entry first. */
export type HelpId = {
  [A in keyof HelpTree & string]: `${A}.${keyof HelpTree[A] & string}`;
}[keyof HelpTree & string];
