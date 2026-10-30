/** IPv4/IPv6 CIDR matching for published crawler ranges (#92). Malformed input never matches. */
interface Address { bits: 32 | 128; value: bigint }

const ipv4 = (ip: string): bigint | null => {
  const parts = ip.split('.');
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return null;
  return parts.reduce((acc, part) => (acc << 8n) + BigInt(Number(part)), 0n);
};

const ipv6 = (ip: string): bigint | null => {
  if (!ip.includes(':') || /[^0-9a-f:.]/iu.test(ip)) return null;
  let canonical: string;
  try { canonical = new URL(`http://[${ip}]`).hostname.slice(1, -1); } catch { return null; }
  const [head, tail = null] = canonical.split('::');
  const groups = (value: string) => (value ? value.split(':') : []);
  const left = groups(head);
  const right = tail === null ? [] : groups(tail);
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (tail === null && missing !== 0)) return null;
  const all = [...left, ...Array<string>(missing).fill('0'), ...right];
  return all.reduce((acc, group) => (acc << 16n) + BigInt(parseInt(group, 16)), 0n);
};

export const parseAddress = (ip: string): Address | null => {
  const value = ip.trim();
  const v4 = ipv4(value);
  if (v4 !== null) return { bits: 32, value: v4 };
  const v6 = ipv6(value);
  return v6 === null ? null : { bits: 128, value: v6 };
};

export const isValidCidr = (cidr: string): boolean => {
  const [base, length, extra] = cidr.trim().split('/');
  const address = parseAddress(base ?? '');
  const bits = Number(length);
  return extra === undefined && !!address && /^\d{1,3}$/.test(length ?? '') && bits <= address.bits;
};

/** True when the address lies in any CIDR of the same family. */
export const inRanges = (ip: string, cidrs: readonly string[]): boolean => {
  const address = parseAddress(ip);
  if (!address) return false;
  return cidrs.some((cidr) => {
    if (!isValidCidr(cidr)) return false;
    const [base, length] = cidr.trim().split('/');
    const start = parseAddress(base)!;
    if (start.bits !== address.bits) return false;
    const shift = BigInt(address.bits - Number(length));
    return (address.value >> shift) === (start.value >> shift);
  });
};
