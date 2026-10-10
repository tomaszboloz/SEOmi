import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HeadingsIssuesCallout } from '@/components/Results/headingsTree/HeadingsIssuesCallout';
import { HeadingsKeyphraseSection } from '@/components/Results/headingsTree/HeadingsKeyphraseSection';
import { HeadingsSummaryCards } from '@/components/Results/headingsTree/HeadingsSummaryCards';
import { MetadataAccessibility } from '@/components/Results/metadata/MetadataAccessibility';
import type { PageAuditData } from '@/types';

const baseAudit: PageAuditData = {
  url: 'https://example.com/',
  final_url: 'https://example.com/',
  http_status: 200,
  response_time_ms: 50,
  timestamp: '2026-10-06T12:00:00Z',
  health_score: 90,
  headings: {
    h1_count: 1,
    h2_count: 2,
    h3_count: 0,
    h4_count: 0,
    h5_count: 0,
    h6_count: 0,
    tree: [],
  },
  images: [],
  links: { total_links: 0, internal_links: 0, external_links: 0, nofollow_links: 0, links: [] },
  issues: [],
} as unknown as PageAuditData;

describe('unreferenced components batch 4 direct assertions', () => {
  it('HeadingsIssuesCallout renders issue list', () => {
    const { rerender } = render(<HeadingsIssuesCallout issues={['Multiple H1 tags']} />);
    expect(screen.getByText('Multiple H1 tags')).toBeDefined();

    rerender(<HeadingsIssuesCallout issues={[]} />);
    expect(screen.queryByText('Multiple H1 tags')).toBeNull();
  });

  it('HeadingsKeyphraseSection renders keyphrase input', () => {
    const setKeyphrase = vi.fn();
    render(
      <HeadingsKeyphraseSection
        audit={baseAudit}
        keyphrase=""
        setKeyphrase={setKeyphrase}
        savedKeyphraseKey={null}
      />,
    );
    const input = screen.getByRole('textbox');
    expect((input as HTMLInputElement).value).toBe('');
    fireEvent.change(input, { target: { value: 'seo title' } });
    expect(setKeyphrase).toHaveBeenCalledWith('seo title');
  });

  it('HeadingsSummaryCards renders heading counts', () => {
    render(
      <HeadingsSummaryCards
        headings={baseAudit.headings}
        totalHeadings={3}
      />,
    );
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('MetadataAccessibility renders when accessibility data is present', () => {
    const auditWithA11y: PageAuditData = {
      ...baseAudit,
      accessibility: {
        score: 85,
        total_checks: 10,
        passed_checks: 8,
        document_language: 'en',
        form_control_count: 10,
        unlabeled_form_control_count: 2,
        aria_attribute_count: 4,
        landmarks: [],
        findings: [],
        manual_review_items: [],
      } as any,
    };

    const { container } = render(<MetadataAccessibility audit={auditWithA11y} />);
    expect(container.querySelector('h4')?.textContent).toBeTruthy();
    expect(screen.getByText('2 / 10')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });
});
