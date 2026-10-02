import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { HeadingsSummaryCards } from '@/components/Results/HeadingsSummaryCards';
import { HeadingsViolations } from '@/components/Results/HeadingsViolations';
import { HeadingsTree } from '@/components/Results/HeadingsTree';
import { copyText } from '@/services/clipboard';
import type { PageAuditData } from '@/types';

vi.mock('@/services/clipboard', () => ({ copyText: vi.fn() }));
beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => vi.useRealTimers());

const headings = (overrides: Partial<PageAuditData['headings']> = {}) => ({ h1_count: 1, h1_texts: ['A'], hierarchy: [{ level: 1, text: 'A', children: [{ level: 2, text: 'B', children: [] }] }], has_valid_hierarchy: true, issues: [], ...overrides }) as PageAuditData['headings'];

describe('headings summary cards', () => {
  it('shows counts and a valid hierarchy', () => {
    render(<HeadingsSummaryCards headings={headings()} totalHeadings={2} />);
    expect(screen.getByText(i18n.t('headings.validHierarchy'))).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('flags missing or repeated H1 and an invalid hierarchy', () => {
    render(<HeadingsSummaryCards headings={headings({ h1_count: 0, has_valid_hierarchy: false })} totalHeadings={0} />);
    expect(screen.getByText(i18n.t('headings.invalidHierarchy'))).toBeTruthy();
    expect(screen.getAllByText('0')).toHaveLength(2);
  });
});

describe('headings violations', () => {
  it('renders nothing without issues and every issue otherwise', () => {
    const view = render(<HeadingsViolations issues={[]} />);
    expect(view.container.textContent).toBe('');
    view.rerender(<HeadingsViolations issues={['Skipped level', 'Empty heading']} />);
    expect(within(screen.getByRole('list')).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Skipped level', 'Empty heading']);
  });
});

describe('headings tree copy feedback', () => {
  it('copies a Markdown outline and resets the confirmation after two seconds', async () => {
    vi.useFakeTimers();
    vi.mocked(copyText).mockResolvedValue(true);
    render(<HeadingsTree audit={{ url: 'https://a.test/', headings: headings() } as unknown as PageAuditData} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('headings.copyTree') })); });
    expect(copyText).toHaveBeenCalledWith('# A\n## B');
    expect(screen.getByText(i18n.t('legacyUi.headings.copied'))).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(screen.queryByText(i18n.t('legacyUi.headings.copied'))).toBeNull();
  });
});
