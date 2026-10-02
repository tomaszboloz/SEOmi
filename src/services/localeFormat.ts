import i18n from 'i18next';

/**
 * BCP 47 locale of the selected UI language. Numbers and dates must follow the
 * language chosen in SEOmi, not the operating system locale of the machine.
 */
export const appLocale = (): string => (i18n.language || 'en').replace('_', '-');
