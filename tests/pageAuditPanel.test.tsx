import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { expect, it, vi } from 'vitest';
import type { PageAuditData } from '@/types';

vi.mock('@/components/Results/HeadingsTree', () => ({ HeadingsTree: ({ audit }: { audit: PageAuditData }) => <p>headings:{audit.url}</p> }));
vi.mock('@/components/Results/DataForSEOAudit', () => ({ DataForSEOAudit: ({ audit }: { audit?: PageAuditData }) => <p>dataforseo:{audit?.url ?? 'none'}</p> }));

const { DataForSEOAudit, PageAuditPanel } = await import('@/components/Layout/PageAuditPanel');
const audit = { url: 'https://example.com/a' } as PageAuditData;

it('labels the panel by the active tab and lazily renders only that result view', async () => {
  render(<Suspense fallback="loading"><PageAuditPanel audit={audit} activeTab="headings" /></Suspense>);
  expect(await screen.findByText('headings:https://example.com/a')).toBeTruthy();
  const panel = screen.getByRole('tabpanel');
  expect(panel.id).toBe('audit-panel');
  expect(panel.getAttribute('aria-labelledby')).toBe('audit-tab-headings');
  expect(screen.queryByText(/dataforseo:/)).toBeNull();
});

it('exposes the lazy DataForSEO view for audit-less usage', async () => {
  render(<Suspense fallback="loading"><DataForSEOAudit /></Suspense>);
  expect(await screen.findByText('dataforseo:none')).toBeTruthy();
});
