import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AmpDetectionCards } from '@/components/Results/ampAudit/AmpDetectionCards';
import { AmpHtmlUrlsCard } from '@/components/Results/ampAudit/AmpHtmlUrlsCard';
import { AmpFindingsCard } from '@/components/Results/ampAudit/AmpFindingsCard';
import { AmpUncheckedCard } from '@/components/Results/ampAudit/AmpUncheckedCard';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts === 'object') {
    return `${key} ${JSON.stringify(opts)}`;
  }
  return key;
}) as any;

describe('AmpAuditView modular architecture and subcomponents', () => {
  it('satisfies physical LOC <= 150 across ampAudit files', () => {
    const files = [
      'src/components/Results/AmpAuditView.tsx',
      ...codeFiles('src/components/Results/ampAudit'),
    ];
    expect(files.length).toBe(6);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders AmpDetectionCards and AmpHtmlUrlsCard', () => {
    const report = {
      detected: true,
      is_amp_document: false,
      amphtml_urls: ['https://example.com/amp/doc'],
      canonical_url: 'https://example.com/regular/doc',
      coverage: 'partial-local-rules',
      findings: [],
      unchecked: [],
    } as any;

    render(
      <div>
        <AmpDetectionCards report={report} t={mockT} />
        <AmpHtmlUrlsCard urls={report.amphtml_urls} t={mockT} />
      </div>,
    );

    expect(screen.getByText('https://example.com/regular/doc')).toBeDefined();
    expect(screen.getByText('https://example.com/amp/doc')).toBeDefined();
    expect(screen.getByText('ampUi.alternateUrl')).toBeDefined();
  });

  it('renders AmpFindingsCard empty and non-empty states', () => {
    const { rerender } = render(<AmpFindingsCard findings={[]} t={mockT} />);
    expect(screen.getByText('ampUi.noFindings')).toBeDefined();

    const finding = {
      code: 'amp-img-missing-dimensions',
      severity: 'warning',
      message: 'amp-img lacks explicit dimensions',
      evidence: '<amp-img src="test.jpg">',
      recommendation: 'Add width and height attributes',
    } as any;

    rerender(<AmpFindingsCard findings={[finding]} t={mockT} />);
    expect(screen.getByText('<amp-img src="test.jpg">')).toBeDefined();
  });

  it('renders AmpUncheckedCard with out-of-scope items', () => {
    render(
      <AmpUncheckedCard
        unchecked={['CORS checks on AMP assets', 'AMP cache validation']}
        t={mockT}
      />,
    );

    expect(screen.getByText('CORS checks on AMP assets')).toBeDefined();
    expect(screen.getByText('AMP cache validation')).toBeDefined();
  });
});
