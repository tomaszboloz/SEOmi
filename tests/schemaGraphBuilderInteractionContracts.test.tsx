import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SchemaGraphBuilder } from '@/components/Charts/SchemaGraphBuilder';
import { createEmptyTopicalMap } from '@/services/topicalMap';
import { createCrawlPageFixture } from './fixtures/crawl';
import { copyText } from '@/services/clipboard';
import i18n from '@/i18n';
vi.mock('@/services/clipboard', () => ({ copyText: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
const props = () => ({
  document: createEmptyTopicalMap(), pages: [createCrawlPageFixture({ url: 'https://site.test/post', final_url: 'https://site.test/post', schema_types: ['Article'] })],
  siteUrl: 'https://site.test', selectedUrl: 'https://site.test/post', includeOrganization: false, includeUrlBreadcrumbs: false, articleType: '' as const,
  onSelectedUrlChange: vi.fn(), onIncludeOrganizationChange: vi.fn(), onIncludeUrlBreadcrumbsChange: vi.fn(), onArticleTypeChange: vi.fn(),
});
it('connects page, organization, breadcrumb and observed article controls to their callbacks', () => {
  const input = props(); render(<SchemaGraphBuilder {...input} />);
  fireEvent.change(screen.getByRole('combobox', { name: i18n.t('schemaUi.pageAria') }), { target: { value: '' } });
  expect(input.onSelectedUrlChange).toHaveBeenCalledWith('');
  fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('schemaUi.includeOrganization') })); expect(input.onIncludeOrganizationChange).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('schemaUi.includeUrlBreadcrumbs') })); expect(input.onIncludeUrlBreadcrumbsChange).toHaveBeenCalledWith(true);
  fireEvent.change(screen.getByRole('combobox', { name: i18n.t('schemaUi.articleTypeAria') }), { target: { value: 'Article' } }); expect(input.onArticleTypeChange).toHaveBeenCalledWith('Article');
});
it.each(['ftp://site.test/post', 'not-url', 'https://site.test/missing'])('shows an honest unselected preview for %s', selectedUrl => {
  render(<SchemaGraphBuilder {...props()} selectedUrl={selectedUrl} />);
  expect(screen.getByText(i18n.t('schemaUi.chooseToPreview'))).toBeTruthy(); expect(screen.queryByRole('button', { name: i18n.t('schemaUi.copyScript') })).toBeNull();
});
it('deduplicates fragments/final URLs and rejects non-HTTP page declarations', () => {
  const input = props(); const valid = input.pages[0];
  render(<SchemaGraphBuilder {...input} pages={[valid, { ...valid, final_url: valid.final_url+'#section' }, { ...valid, final_url: '', url: 'file:///tmp/page' }]} />);
  expect((screen.getByRole('combobox', { name: i18n.t('schemaUi.pageAria') }) as HTMLSelectElement).options).toHaveLength(2);
});
it('shows an empty-page state without constructing a preview', () => {
  render(<SchemaGraphBuilder {...props()} pages={[]} />);
  expect(screen.getByText(i18n.t('schemaUi.noPages'))).toBeTruthy();
});
it.each(['unavailable', 'rejected'])('reports clipboard %s and allows a later successful copy', async mode => {
  const mock = vi.mocked(copyText);
  if (mode === 'unavailable') mock.mockResolvedValueOnce(false); else mock.mockRejectedValueOnce(new Error('clipboard blocked'));
  mock.mockResolvedValueOnce(true); vi.useFakeTimers(); render(<SchemaGraphBuilder {...props()} />);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: i18n.t('schemaUi.copyScript') })));
  expect(screen.getByRole('alert').textContent).toBe(i18n.t('schemaUi.copyError'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: i18n.t('schemaUi.copyScript') })));
  expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByRole('button', { name: i18n.t('schemaUi.copiedHtml') })).toBeTruthy();
  expect(mock).toHaveBeenLastCalledWith(expect.stringContaining('<script type="application/ld+json">'));
  act(() => vi.advanceTimersByTime(1800)); expect(screen.getByRole('button', { name: i18n.t('schemaUi.copyScript') })).toBeTruthy();
});

it('renders declared article and breadcrumb warnings with complete preview evidence', () => {
  const input = props(); input.document.entity.name = 'Observed organization';
  const page = { ...input.pages[0], title: 'Observed title', meta_description: 'Observed description' };
  render(<SchemaGraphBuilder {...input} pages={[page]} includeOrganization includeUrlBreadcrumbs articleType="Article" />);
  expect(screen.queryByRole('list', { name: i18n.t('schemaUi.omittedFields') })).toBeNull();
  expect(screen.getByText(i18n.t('schemaUi.breadcrumbWarning'))).toBeTruthy();
  expect(screen.getByText(i18n.t('schemaUi.articleWarning', { type: 'Article' }))).toBeTruthy();
});
it('uses the literal page URL when optional legacy title and schema evidence are absent', () => {
  const input = props(); const page = { ...input.pages[0], final_url: '', title: '', schema_types: undefined };
  render(<SchemaGraphBuilder {...input} pages={[page as never]} />);
  const selector = screen.getByRole('combobox', { name: i18n.t('schemaUi.pageAria') }) as HTMLSelectElement;
  expect(selector.options[1].textContent).toBe('https://site.test/post · https://site.test/post');
  expect(screen.queryByRole('combobox', { name: i18n.t('schemaUi.articleTypeAria') })).toBeNull();
});
