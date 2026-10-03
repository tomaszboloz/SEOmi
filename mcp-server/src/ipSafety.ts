import { isIP } from 'node:net';

export const parseIpv4 = (address: string): [number, number, number, number] | null => {
  if (isIP(address) !== 4) return null;
  const parts = address.split('.').map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts as [number, number, number, number]
    : null;
};

export const parseIpv6Words = (address: string): number[] | null => {
  let value = address.toLowerCase();
  if (value.includes('.')) {
    const separator = value.lastIndexOf(':');
    const ipv4 = parseIpv4(value.slice(separator + 1));
    if (!ipv4) return null;
    const high = ((ipv4[0] << 8) | ipv4[1]).toString(16);
    const low = ((ipv4[2] << 8) | ipv4[3]).toString(16);
    value = `${value.slice(0, separator)}:${high}:${low}`;
  }
  const halves = value.split('::');
  if (halves.length > 2) return null;
  const parseHalf = (half: string) => (half ? half.split(':').map((part) => (/^[0-9a-f]{1,4}$/.test(part) ? Number.parseInt(part, 16) : Number.NaN)) : []);
  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] || '');
  if ([...left, ...right].some((word) => !Number.isInteger(word)) || left.length + right.length > 8) return null;
  const fillCount = 8 - left.length - right.length;
  if (halves.length === 1 && fillCount !== 0) return null;
  if (halves.length === 2 && fillCount < 1) return null;
  return [...left, ...Array.from({ length: fillCount }, () => 0), ...right];
};

export const isPublicAddress = (address: string): boolean => {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = parseIpv4(address)!;
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0 && c === 0)
      || (a === 192 && b === 0 && c === 2)
      || (a === 192 && b === 88 && c === 99)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113));
  }
  if (family !== 6) return false;
  const words = parseIpv6Words(address);
  if (!words) return false;
  const mapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (mapped) {
    const ipv4 = [words[6] >> 8, words[6] & 0xff, words[7] >> 8, words[7] & 0xff].join('.');
    return isPublicAddress(ipv4);
  }
  const first = words[0];
  const second = words[1];
  return first >= 0x2000 && first <= 0x3fff
    && !(first === 0x2001 && second <= 0x01ff)
    && !(first === 0x2001 && second === 0x0db8)
    && first !== 0x2002;
};
