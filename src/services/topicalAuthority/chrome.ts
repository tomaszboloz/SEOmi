/** Link placement written by the crawler (issue #70, DOM ancestry). */
export type LinkOrigin = 'menu' | 'sidebar_footer' | 'content' | 'unknown';

/**
 * Menu and sidebar/footer come straight from the crawler's `zone`. The crawler merges sidebar and footer
 * into one zone, so this stays one flag instead of pretending to tell them apart.
 * `unknown` means an older run without zone data; callers then fall back to the shared-target heuristic.
 */
export const linkOrigin = (zone: string | null | undefined): LinkOrigin => {
  if (zone === 'nav_breadcrumb') return 'menu';
  if (zone === 'sidebar_footer') return 'sidebar_footer';
  if (zone === 'main' || zone === 'widget') return 'content';
  return 'unknown';
};

export const isChromeOrigin = (origin: LinkOrigin): boolean => origin === 'menu' || origin === 'sidebar_footer';

export interface ChromeFlags { menu: number; sidebarFooter: number; content: number; unknown: number }

/** Counts links per origin so the report can say how much of the link graph is flagged by real zone data. */
export const countOrigins = (zones: Array<string | null | undefined>): ChromeFlags => {
  const flags: ChromeFlags = { menu: 0, sidebarFooter: 0, content: 0, unknown: 0 };
  zones.forEach((zone) => {
    const origin = linkOrigin(zone);
    if (origin === 'menu') flags.menu += 1;
    else if (origin === 'sidebar_footer') flags.sidebarFooter += 1;
    else flags[origin] += 1;
  });
  return flags;
};
