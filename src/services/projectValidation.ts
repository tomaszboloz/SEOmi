import i18n from '@/i18n';

export type ProjectRootUrlValidation =
  | { ok: true; value?: string }
  | { ok: false; message: string };

export type ProjectNameValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

const invalidUrlMessage = () => i18n.t('projects.validation.invalidUrl');
const privateUrlMessage = () => i18n.t('projects.validation.privateUrl');

export const validateProjectName = (input: string): ProjectNameValidation => {
  const value = input.trim();
  if (!value) return { ok: false, message: i18n.t('projects.validation.nameRequired') };
  if ([...value].length > 80) return { ok: false, message: i18n.t('projects.validation.nameTooLong') };
  if (/[\u0000-\u001f\u007f]/.test(value)) return { ok: false, message: i18n.t('projects.validation.nameInvalidChars') };
  return { ok: true, value };
};

const isIpv4 = (hostname: string): boolean => {
  const parts = hostname.split('.');
  return parts.length === 4 && parts.every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
};

const isPrivateIpv4 = (hostname: string): boolean => {
  if (!isIpv4(hostname)) return false;
  const [a, b, c] = hostname.split('.').map(Number);
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;
};

const isPrivateIpv6 = (hostname: string): boolean => {
  const value = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!value.includes(':')) return false;

  // IPv4-mapped addresses must follow the same SSRF policy as IPv4.
  const mappedIpv4 = value.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4 && isPrivateIpv4(mappedIpv4[1])) return true;

  return value === '::'
    || value === '::1'
    || value.startsWith('fc')
    || value.startsWith('fd')
    || /^(fe[89ab])/.test(value)
    || value.startsWith('2001:db8:')
    || value.startsWith('2002:');
};

const isPrivateHost = (hostname: string): boolean => {
  // A trailing root dot names the same host: "localhost." is localhost.
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  return value === 'localhost'
    || value.endsWith('.localhost')
    || value.endsWith('.local')
    || value.endsWith('.internal')
    || value.endsWith('.lan')
    || isPrivateIpv4(value)
    || isPrivateIpv6(value);
};

/**
 * Validate the optional project root without contacting the network.
 * The backend repeats the same policy before every request; this prevents a
 * malformed or secret-bearing value from being persisted in project metadata.
 */
export const validateProjectRootUrl = (input?: string): ProjectRootUrlValidation => {
  const trimmed = input?.trim() || '';
  if (!trimmed) return { ok: true };
  if ([...trimmed].length > 2048) return { ok: false, message: i18n.t('projects.validation.rootTooLong') };

  const hasExplicitScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed);
  const looksLikeNonHttpScheme = /^[a-z][a-z\d+.-]*:(?!\d+(?:[/?#]|$))/i.test(trimmed);
  if (looksLikeNonHttpScheme && !hasExplicitScheme) return { ok: false, message: i18n.t('projects.validation.httpOnly') };

  const candidate = hasExplicitScheme ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, message: invalidUrlMessage() };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, message: i18n.t('projects.validation.httpOnly') };
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    return { ok: false, message: parsed.username || parsed.password ? i18n.t('projects.validation.credentials') : invalidUrlMessage() };
  }
  if (isPrivateHost(parsed.hostname)) return { ok: false, message: privateUrlMessage() };

  // A root URL does not need a meaningless trailing slash, keeping existing
  // project labels stable while still normalising missing schemes and casing.
  const value = parsed.toString().replace(/\/$/, '');
  return { ok: true, value };
};
