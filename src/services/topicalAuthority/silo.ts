import { normalizeUrl } from '@/services/siteFocus/pageType';
import { pathSegments } from '@/services/siteFocus/pageType';
import { isChromeOrigin, linkOrigin } from './chrome';
import { unigramKeys, type AuthorityContext, type AuthorityPage } from './context';
import { blend } from './depth';
import { isGenericAnchor } from './genericAnchors';
import type { LinkAudit, SiloReport } from './types';

export const SILC_WEIGHTS = { connectivity: 0.45, anchors: 0.35, orphans: 0.2 } as const;
export const GENERIC_ANCHOR_WEIGHT = 0.1;
const CHROME_SHARE = 0.5;
const CHROME_MIN_PAGES = 8;
const ANCHOR_FULL_COSINE = 0.3;
const WEAK_ANCHOR = 0.5;
const BLEED_BELOW = 40;
const CONN = { toPillar: 0.5, fromPillar: 0.3, siblings: 0.2 } as const;

/** `untagged`: every link of this edge lacks crawler zone data, so only the shared-target heuristic can judge it. */
interface Edge { from: string; to: string; anchors: string[]; untagged: boolean }

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * In-content internal links between analysed pages. Links the crawler placed in a menu or sidebar/footer
 * are dropped by their zone. Only links without zone data fall back to the guess that a target
 * most pages link to is site chrome.
 */
export const contentEdges = (context: AuthorityContext): Edge[] => {
  const edges = new Map<string, Edge>();
  context.pages.forEach((entry) => entry.page.links.filter((link) => link.is_internal).forEach((link) => {
    const to = normalizeUrl(link.target_url);
    const origin = linkOrigin(link.zone);
    if (to === entry.url || !context.byUrl.has(to) || isChromeOrigin(origin)) return;
    const edge = edges.get(`${entry.url}|${to}`) ?? { from: entry.url, to, anchors: [], untagged: true };
    edge.anchors.push(link.anchor_text ?? '');
    if (origin !== 'unknown') edge.untagged = false;
    edges.set(`${entry.url}|${to}`, edge);
  }));
  const sources = new Map<string, number>();
  edges.forEach((edge) => { if (edge.untagged) sources.set(edge.to, (sources.get(edge.to) ?? 0) + 1); });
  const chrome = context.pages.length >= CHROME_MIN_PAGES ? context.pages.length * CHROME_SHARE : Infinity;
  return [...edges.values()].filter((edge) => !edge.untagged || sources.get(edge.to)! < chrome);
};

/** Descriptive anchors score by cosine with the target's declared topic; generic ones count 0.1. */
export const anchorScore = (anchor: string, target: AuthorityPage, language: string): number => {
  if (isGenericAnchor(anchor)) return GENERIC_ANCHOR_WEIGHT;
  const keys = unigramKeys(anchor, language);
  if (!keys.size || !target.zone.size) return GENERIC_ANCHOR_WEIGHT;
  const shared = [...keys].filter((key) => target.zone.has(key)).length;
  return Math.max(GENERIC_ANCHOR_WEIGHT, Math.min(1, shared / Math.sqrt(keys.size * target.zone.size) / ANCHOR_FULL_COSINE));
};

/** First path segment groups pages when no reference taxonomy assigns pillars. */
export const groupByDirectory = (pages: AuthorityPage[]): Map<string, AuthorityPage[]> => {
  const groups = new Map<string, AuthorityPage[]>();
  pages.forEach((entry) => { const key = pathSegments(entry.url)[0] ?? '/'; groups.set(key, [...(groups.get(key) ?? []), entry]); });
  return groups;
};

const groupConnectivity = (members: AuthorityPage[], links: Set<string>, inbound: Map<string, number>): { pillar: AuthorityPage; value: number | null } => {
  const pillar = [...members].sort((a, b) => (inbound.get(b.url) ?? 0) - (inbound.get(a.url) ?? 0) || b.focus.trs - a.focus.trs || (a.url < b.url ? -1 : 1))[0];
  const satellites = members.filter((entry) => entry !== pillar);
  if (!satellites.length) return { pillar, value: null };
  const scores = satellites.map((sat) => {
    const siblings = satellites.filter((other) => other !== sat);
    const toSiblings = siblings.filter((other) => links.has(`${sat.url}|${other.url}`)).length;
    return blend([
      [CONN.toPillar, links.has(`${sat.url}|${pillar.url}`) ? 1 : 0],
      [CONN.fromPillar, links.has(`${pillar.url}|${sat.url}`) ? 1 : 0],
      [CONN.siblings, siblings.length ? Math.min(1, toSiblings / Math.min(2, siblings.length)) : null],
    ]) as number;
  });
  return { pillar, value: scores.reduce((sum, value) => sum + value, 0) / scores.length };
};

/** Silo Cohesion (SILC) = (0.45 * cluster connectivity + 0.35 * anchor alignment + 0.20 * (1 - orphan/bleed share)) * 100. */
export const auditSilo = (context: AuthorityContext, eligible: AuthorityPage[], groups: Map<string, AuthorityPage[]>): SiloReport => {
  const edges = contentEdges(context);
  const links = new Set(edges.map((edge) => `${edge.from}|${edge.to}`));
  const inbound = new Map<string, number>();
  edges.forEach((edge) => inbound.set(edge.to, (inbound.get(edge.to) ?? 0) + 1));
  const ok = new Set(eligible.map((entry) => entry.url));
  const scored = edges.filter((edge) => ok.has(edge.to) && ok.has(edge.from)).flatMap((edge) => edge.anchors.map((anchor) => anchorScore(anchor, context.byUrl.get(edge.to) as AuthorityPage, context.language)));
  const audits: Record<string, LinkAudit> = {};
  const connectivity: number[] = [];
  groups.forEach((members) => {
    const { pillar, value } = groupConnectivity(members, links, inbound);
    if (value !== null) connectivity.push(value);
    members.forEach((entry) => { audits[entry.url] = { pillarUrl: pillar.url, linksToPillar: entry === pillar || links.has(`${entry.url}|${pillar.url}`), inbound: inbound.get(entry.url) ?? 0, bleedTargets: [] }; });
  });
  const bleedLinks = edges.filter((edge) => ok.has(edge.from) && context.byUrl.get(edge.to)!.focus.trs < BLEED_BELOW && context.byUrl.get(edge.to)!.focus.type !== 'technical').map((edge) => ({ from: edge.from, to: edge.to }));
  bleedLinks.forEach((edge) => { (audits[edge.from] ??= { linksToPillar: false, inbound: inbound.get(edge.from) ?? 0, bleedTargets: [] }).bleedTargets.push(edge.to); });
  const nonHome = eligible.filter((entry) => entry.focus.type !== 'homepage');
  const orphans = nonHome.filter((entry) => !(inbound.get(entry.url) ?? 0)).map((entry) => entry.url).sort();
  const orphanRatio = nonHome.length ? orphans.length / nonHome.length : 0;
  const bleedRatio = eligible.length ? new Set(bleedLinks.map((edge) => edge.from)).size / eligible.length : 0;
  const connectivityMean = connectivity.length ? connectivity.reduce((sum, value) => sum + value, 0) / connectivity.length : null;
  const anchorMean = scored.length ? scored.reduce((sum, value) => sum + value, 0) / scored.length : null;
  const score = eligible.length ? blend([
    [SILC_WEIGHTS.connectivity, connectivityMean], [SILC_WEIGHTS.anchors, anchorMean], [SILC_WEIGHTS.orphans, 1 - Math.min(1, orphanRatio + bleedRatio)],
  ]) : null;
  return {
    score: score === null ? null : Math.round(score * 1000) / 10, clusterConnectivity: connectivityMean === null ? null : round3(connectivityMean),
    anchorAlignment: anchorMean === null ? null : round3(anchorMean), orphanRatio: round3(orphanRatio), bleedRatio: round3(bleedRatio),
    orphans, weakAnchors: scored.filter((value) => value < WEAK_ANCHOR).length, bleedLinks, audits,
  };
};
