import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/i18n';
import { TrustFindings } from '@/components/Domain/crawlResults/trust/TrustFindings';
import { SEVERITY_TEXT } from '@/components/Domain/crawlResults/trust/trustHelpers';
import type { TrustFinding } from '@/services/eeatTrust';

describe('TrustFindings', () => {
  it('shows the all-clear message for no findings', () => {
    render(<TrustFindings findings={[]} />);
    expect(screen.getByText('No trust gaps were detected.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('lists findings in order with severity styling and a code fallback for unknown codes', () => {
    const findings = [
      { code: 'unknown.code.xyz', severity: 'critical', params: {} },
      { code: 'unknown.other', severity: 'info', params: { a: 1 } },
    ] as unknown as TrustFinding[];
    render(<TrustFindings findings={findings} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('unknown.code.xyz');
    expect(items[1].textContent).toContain('unknown.other');
    expect(items[0].querySelector('span')?.className).toContain(SEVERITY_TEXT.critical);
    expect(items[1].querySelector('span')?.className).toContain(SEVERITY_TEXT.info);
    expect(screen.getByRole('region', { name: 'What to fix first' })).toBeTruthy();
  });
});
