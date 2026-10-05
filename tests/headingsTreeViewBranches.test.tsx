import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { HeadingsTreeView } from '@/components/Results/headingsTree/HeadingsTreeView';
import type { HeadingNode } from '@/types';

const mocks = vi.hoisted(() => ({ copyText: vi.fn() }));
vi.mock('@/services/clipboard', () => ({ copyText: mocks.copyText }));
vi.mock('@/components/Results/ShowOnPageButton', () => ({
  ShowOnPageButton: (p: { url: string; selector: string; needle?: string; label: string }) => <i data-testid="show" data-url={p.url} data-selector={p.selector} data-needle={p.needle ?? ''} data-label={p.label} />,
}));

const t = (k: string, o?: object) => i18n.t(k, o);
const nodes = [1, 2, 3, 4, 5].map((level) => ({ level, text: `Title ${level}` })) as HeadingNode[];
beforeEach(async () => { await i18n.changeLanguage('en'); mocks.copyText.mockReset().mockResolvedValue(true); });

it('renders an empty state without headings', () => {
  render(<HeadingsTreeView flatHeadings={[]} auditUrl="https://a.test" />);
  expect(screen.getByText(t('legacyUi.headings.none'))).toBeTruthy();
  expect(screen.queryAllByTestId('show')).toHaveLength(0);
});

it('indents by level, colours badges per level and wires ShowOnPage', () => {
  render(<HeadingsTreeView flatHeadings={nodes} auditUrl="https://a.test" />);
  const badge = (level: number) => screen.getByText(t('uiUnits.headingLevel', { level }));
  expect(badge(1).className).toContain('emerald');
  expect(badge(2).className).toContain('blue');
  expect(badge(3).className).toContain('purple');
  expect(badge(4).className).toContain('amber');
  expect(badge(5).className).toContain('slate-800');
  expect((badge(3).parentElement as HTMLElement).style.paddingLeft).toBe('48px');
  const show = screen.getAllByTestId('show')[1];
  expect(show.dataset).toMatchObject({ url: 'https://a.test', selector: 'h2', needle: 'Title 2', label: 'H2 Title 2' });
});

it('shows a placeholder for empty heading text', () => {
  render(<HeadingsTreeView flatHeadings={[{ level: 2, text: '' } as HeadingNode]} auditUrl="u" />);
  expect(screen.getByText(t('legacyUi.headings.empty'))).toBeTruthy();
  const show = screen.getByTestId('show');
  expect(show.dataset.needle).toBe('');
  expect(show.dataset.label).toBe(`H2 ${t('legacyUi.headings.emptyLabel')}`);
});

it('copies the markdown outline and confirms, but stays silent on clipboard failure', async () => {
  render(<HeadingsTreeView flatHeadings={nodes.slice(0, 3)} auditUrl="u" />);
  const btn = screen.getByRole('button');
  fireEvent.click(btn);
  expect(mocks.copyText).toHaveBeenCalledWith('# Title 1\n## Title 2\n### Title 3');
  await waitFor(() => expect(btn.textContent).toContain(t('legacyUi.headings.copied')));
});

it('keeps the copy label when copying fails', async () => {
  mocks.copyText.mockResolvedValue(false);
  render(<HeadingsTreeView flatHeadings={nodes.slice(0, 1)} auditUrl="u" />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(mocks.copyText).toHaveBeenCalled());
  expect(screen.getByRole('button').textContent).toContain(t('headings.copyTree'));
});
