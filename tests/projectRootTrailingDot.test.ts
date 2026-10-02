import { beforeEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import { validateProjectRootUrl } from '@/services/projectValidation';

beforeEach(async () => { await i18n.changeLanguage('en'); });

it.each(['localhost.', 'http://localhost./', 'https://printer.local./', 'api.internal.', 'https://router.LAN..'])('rejects the root-dot form of local host %s', (input) => {
  expect(validateProjectRootUrl(input).ok).toBe(false);
});

it('keeps accepting a public host written with a root dot', () => {
  expect(validateProjectRootUrl('https://example.com./').ok).toBe(true);
});
