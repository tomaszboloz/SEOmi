const norm = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** After a write the CMS may re-wrap whitespace; the patched section text must still be present. */
export const sectionApplied = (liveContent: string, replacement: string): boolean => norm(liveContent).includes(norm(replacement));
