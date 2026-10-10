import { describe, expect, it } from 'vitest';
import { buildLinksChecks, buildMediaChecks } from '@/services/auditChecks/mediaAndLinksChecks';
import { audit } from './fixtures/auditChecksContracts';

const link = (patch: Record<string, unknown> = {}) => ({
  href: 'https://example.com/page', text: 'page', is_internal: true, ...patch,
});
const status = (items: { id: string; status: string }[], id: string) =>
  items.find((item) => item.id === id)?.status;

describe('media and link audit fallback branches', () => {
  it('uses empty containers and the blank rel fallback safely', () => {
    expect(status(buildMediaChecks(audit({ images: undefined as never })), 'images-alt')).toBe('not_applicable');
    expect(status(buildLinksChecks(audit({ links: undefined as never, final_url: '' })), 'links-total-consistent')).toBe('pass');

    const checks = buildLinksChecks(audit({
      links: { total_links: 1, internal_links: 1, external_links: 0, nofollow_links: 0,
        links: [link({ target: '_blank', rel: undefined })] },
    }));
    expect(status(checks, 'links-target-blank')).toBe('warning');
  });
});
