import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { MetadataAccessibilityHidden } from '@/components/Results/metadata/MetadataAccessibilityHidden';
import { MetadataDirectives } from '@/components/Results/metadata/MetadataDirectives';
import * as clipboard from '@/services/clipboard';
import type { PageAuditData } from '@/types';

vi.mock('@/components/Results/ShowOnPageButton', () => ({
  ShowOnPageButton: ({ label }: { label: string }) => <button data-testid="show-on-page">{label}</button>,
}));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.restoreAllMocks();
});

const makeBaseAudit = (): PageAuditData => ({
  url: 'https://example.com/test',
  final_url: 'https://example.com/test',
  http_status: 200,
  response_time_ms: 120,
  redirect_chain: [],
  meta_tags: { canonical: '', robots: '', viewport: '', charset: '' },
  links: [],
  headings: [],
  images: [],
  scripts: [],
  stylesheets: [],
  performance: {} as never,
  word_count: 500,
  page_size_bytes: 1024,
} as unknown as PageAuditData);

describe('geminiGapGOVERNORUi: MetadataAccessibilityHidden and MetadataDirectives branches', () => {
  it('exercises MetadataAccessibilityHidden truncation limits, source line/column and zero counts', () => {
    const auditTruncated: PageAuditData = {
      ...makeBaseAudit(),
      accessibility: {
        hidden_form_control_count: 5,
        hidden_form_controls: [
          { dom_position: 1, dom_query: '#h1', html_snippet: '<input hidden>', line: 12, column: 4 },
        ],
        anti_spam_text_control_count: 4,
        anti_spam_text_controls: [
          { dom_position: 1, dom_query: '#spam1', html_snippet: '<input name="bot">' },
        ],
      } as never,
    };

    const view1 = render(<MetadataAccessibilityHidden audit={auditTruncated} />);
    expect(screen.getByText(/source 12:4/i)).toBeTruthy();
    expect(screen.getAllByText(/Shown first 1/i).length).toBe(2);
    view1.unmount();

    const auditUntruncated: PageAuditData = {
      ...makeBaseAudit(),
      accessibility: {
        hidden_form_control_count: 1,
        hidden_form_controls: [
          { dom_position: 1, dom_query: '#h2', html_snippet: '<input hidden>' },
        ],
        anti_spam_text_control_count: 1,
        anti_spam_text_controls: [
          { dom_position: 1, dom_query: '#spam2', html_snippet: '<input>' },
        ],
      } as never,
    };

    const view2 = render(<MetadataAccessibilityHidden audit={auditUntruncated} />);
    expect(screen.queryByText(/First/i)).toBeNull();
    view2.unmount();

    const auditEmpty: PageAuditData = { ...makeBaseAudit(), accessibility: undefined };
    const view3 = render(<MetadataAccessibilityHidden audit={auditEmpty} />);
    expect(screen.queryByText(/hidden/i)).toBeNull();
    view3.unmount();

    const auditNullControls: PageAuditData = {
      ...makeBaseAudit(),
      accessibility: {
        hidden_form_control_count: 5,
        hidden_form_controls: undefined,
        anti_spam_text_control_count: 4,
        anti_spam_text_controls: undefined,
      } as never,
    };
    const view4 = render(<MetadataAccessibilityHidden audit={auditNullControls} />);
    expect(screen.getAllByText(/Shown first 0/i).length).toBe(2);
    view4.unmount();
  });

  it('exercises MetadataDirectives canonical copy success/failure and unverified states', async () => {
    const copySpy = vi.spyOn(clipboard, 'copyText').mockResolvedValue(true);
    const auditWithCanonical = {
      ...makeBaseAudit(),
      meta_tags: { canonical: 'https://example.com/target', robots: 'index,follow', viewport: 'width=device-width', charset: 'utf-8' },
      indexability: { canonical_target_checked: true, canonical_target_status: 200 } as never,
    } as unknown as PageAuditData;

    const view1 = render(<MetadataDirectives audit={auditWithCanonical} />);
    const copyButton = screen.getByRole('button');
    fireEvent.click(copyButton);
    expect(copySpy).toHaveBeenCalledWith('https://example.com/target');
    await waitFor(() => expect(document.querySelector('.lucide-check')).toBeTruthy());
    view1.unmount();

    copySpy.mockResolvedValue(false);
    const view2 = render(<MetadataDirectives audit={auditWithCanonical} />);
    fireEvent.click(screen.getByRole('button'));
    view2.unmount();

    const auditNoCanonical = {
      ...makeBaseAudit(),
      meta_tags: { canonical: '', robots: '', viewport: '', charset: '' },
      indexability: { canonical_target_checked: true, canonical_target_status: 500, canonical_target_check_error: 'Timeout' } as never,
    } as unknown as PageAuditData;
    const view3 = render(<MetadataDirectives audit={auditNoCanonical} />);
    expect(screen.getByText(i18n.t('legacyUi.metadata.notSpecified'))).toBeTruthy();
    expect(screen.getByText(i18n.t('legacyUi.metadata.canonicalUnverified'))).toBeTruthy();
    view3.unmount();
  });
});
