import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlUrlRules } from '@/components/Domain/siteAudit/CrawlUrlRules';

const t = (key: string, values?: Record<string, unknown>) => values ? `${key}:${JSON.stringify(values)}` : key;
const session = (patch: Record<string, unknown> = {}) => ({
  filterValidation: null, isCheckingFilters: false, t, validateFilters: vi.fn(), ...patch,
});

describe('CrawlUrlRules edge contracts', () => {
  it('disables validation while checking', () => {
    render(<CrawlUrlRules session={session({ isCheckingFilters: true }) as never} />);
    expect((screen.getByRole('button', { name: 'siteAudit.checking' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders invalid rules without an optional pattern', () => {
    render(<CrawlUrlRules session={session({
      filterValidation: { valid: false, errors: [{ filter: 'excludePatterns', pattern: '', message: 'invalid rule' }], previews: [] },
    }) as never} />);
    const filter = screen.getByText('excludePatterns');
    expect(filter.parentElement?.textContent).toContain('invalid rule');
  });

  it('renders the valid empty-preview state', () => {
    render(<CrawlUrlRules session={session({ filterValidation: { valid: true, errors: [], previews: [] } }) as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'siteAudit.checkRules' }));
    expect(screen.getByText(/siteAudit\.previewEmpty/)).toBeTruthy();
  });
});
