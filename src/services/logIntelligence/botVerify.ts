/**
 * Claimed vs verified crawler identity (#92). A User-Agent is only a claim.
 * No network access here: DNS resolvers and published IP ranges are injected by the caller.
 * "Google-Extended" is a robots.txt token, not a User-Agent, so it never matches a log line.
 */
export type BotFamily = 'googlebot' | 'bingbot' | 'gptbot' | 'perplexitybot';
export type BotStatus = 'verified' | 'claimed' | 'spoofed' | 'unknown';
export interface BotVerdict { family: BotFamily | null; status: BotStatus; method: 'reverse-forward-dns' | 'published-ranges' | 'none'; checkedAt: number }

export interface Resolver {
  reverse: (ip: string) => Promise<string[]>;
  forward: (host: string) => Promise<string[]>;
}

/** Official suffixes for reverse DNS verification (Google and Bing document this method). */
export const DNS_SUFFIXES: Partial<Record<BotFamily, string[]>> = {
  googlebot: ['.googlebot.com', '.google.com', '.googleusercontent.com'],
  bingbot: ['.search.msn.com'],
};

const TOKENS: Array<[RegExp, BotFamily]> = [[/googlebot/i, 'googlebot'], [/bingbot/i, 'bingbot'], [/gptbot/i, 'gptbot'], [/perplexitybot/i, 'perplexitybot']];

export const claimedFamily = (userAgent: string): BotFamily | null => TOKENS.find(([re]) => re.test(userAgent))?.[1] ?? null;

const ipv4 = (ip: string): number | null => {
  const parts = ip.split('.').map(Number);
  return parts.length === 4 && parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255) ? parts.reduce((acc, p) => acc * 256 + p, 0) : null;
};

/** IPv4 CIDR match; IPv6 and malformed ranges never match (they stay unknown). */
export const inRanges = (ip: string, cidrs: readonly string[]): boolean => {
  const value = ipv4(ip);
  if (value === null) return false;
  return cidrs.some((cidr) => {
    const [base, bits] = cidr.split('/');
    const start = ipv4(base);
    const length = Number(bits);
    if (start === null || !Number.isInteger(length) || length < 0 || length > 32) return false;
    const size = 2 ** (32 - length);
    return Math.floor(value / size) === Math.floor(start / size);
  });
};

export interface VerifyDeps { resolver?: Resolver; ranges?: Partial<Record<BotFamily, readonly string[]>>; now?: () => number }

export const verifyBot = async (ip: string, userAgent: string, deps: VerifyDeps = {}): Promise<BotVerdict> => {
  const checkedAt = (deps.now ?? Date.now)();
  const family = claimedFamily(userAgent);
  if (!family) return { family: null, status: 'unknown', method: 'none', checkedAt };
  const ranges = deps.ranges?.[family];
  if (ranges?.length) {
    const hit = inRanges(ip, ranges);
    return { family, status: hit ? 'verified' : 'spoofed', method: 'published-ranges', checkedAt };
  }
  const suffixes = DNS_SUFFIXES[family];
  if (!suffixes || !deps.resolver) return { family, status: 'claimed', method: 'none', checkedAt };
  try {
    const hosts = (await deps.resolver.reverse(ip)).map((h) => h.toLowerCase().replace(/\.$/, '')).filter((h) => suffixes.some((s) => h.endsWith(s)));
    for (const host of hosts) {
      if ((await deps.resolver.forward(host)).includes(ip)) return { family, status: 'verified', method: 'reverse-forward-dns', checkedAt };
    }
    return { family, status: 'spoofed', method: 'reverse-forward-dns', checkedAt };
  } catch {
    // DNS timeout or failure: not proof of spoofing.
    return { family, status: 'claimed', method: 'none', checkedAt };
  }
};
