import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/i18n';
import { TemplateGovernorPanel } from '@/components/Results/TemplateGovernorPanel';

const base = { pattern: '/dieta-{var}', pageCount: 500, informationGain: 0.12, uniqueVariableShare: 0.04, domSignatureProvenance: 'crawler' as const, injectedVariablesProvenance: 'crawler' as const, verdict: 'template-bloat' as const, urls: [] };
const proposal = (action: 'limit' | 'noindex') => ({ action, scope: 'template-segment' as const, readOnly: true as const, requiresApproval: true as const });

describe('TemplateGovernorPanel', () => {
  it('shows an empty state', () => {
    render(<TemplateGovernorPanel events={[]} />);
    expect(screen.getByTestId('template-governor-panel').textContent).toContain('No weak templates found.');
  });

  it('shows one row per template with the recommendation', () => {
    render(
      <TemplateGovernorPanel
        events={[
          { ...base, action: 'noindex', recommendation: proposal('noindex') },
          { ...base, pattern: '/b-{var}', action: 'limit', recommendation: proposal('limit') },
          { ...base, pattern: '/c-{var}', action: 'none', recommendation: null },
          { ...base, pattern: '/d-{var}', action: 'limit', recommendation: null },
        ]}
      />,
    );
    const text = screen.getByTestId('template-governor-panel').textContent ?? '';
    expect(text).toContain('/dieta-{var}: 500 pages, information gain 12%');
    expect(text).toContain('noindex this segment');
    expect(text).toContain('limit the number of indexed pages');
    expect(screen.getByTestId('template-governor-panel').getAttribute('aria-readonly')).toBe('true');
    expect(screen.getAllByTestId('template-governor-event')).toHaveLength(4);
    expect(screen.getAllByText(/Recommended:/)).toHaveLength(3);
    expect(screen.getAllByTestId('template-governor-event')[0].getAttribute('data-unique-variable-share')).toBe('0.04');
  });
});
