import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationPageRow } from '@/components/Domain/crawlResults/validationTab/ValidationPageRow';
import type { CrawledPageSummary } from '@/types';

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as any;

const basePage = {
  url: 'https://example.test/validation',
  redirect_chain: [],
  depth: 0,
  http_status: 200,
  response_time_ms: 10,
  body_truncated: false,
  word_count: 10,
  schema_types: [],
  schema_syntax_errors: 0,
  hreflangs: [],
  h1_count: 1,
  internal_link_count: 0,
  external_link_count: 0,
  links: [],
  images: [],
  issues_count: 0,
  issues: [],
};

const show = (
  pagePatch: Record<string, unknown> = {},
  findings: Record<string, unknown>[] = [],
) => {
  const page = { ...basePage, ...pagePatch } as unknown as CrawledPageSummary;
  return render(
    <table>
      <tbody>
        <ValidationPageRow
          item={{ page, findings, pageMatches: true } as any}
          t={t}
        />
      </tbody>
    </table>,
  );
};

describe('ValidationPageRow direct contracts', () => {
  it('distinguishes missing charset data, truncation and legacy snapshots', () => {
    const first = show({ html_validation_findings: undefined });
    expect(first.container.textContent).toContain('crawlDeepUi.notDeclared');
    expect(first.container.textContent).toContain('crawlDeepUi.noData');
    expect(first.container.textContent).toContain('crawlDeepUi.legacySnapshotNoData');

    const truncated = show({ body_truncated: true, html_validation_findings: [] });
    expect(truncated.container.textContent).toContain('crawlDeepUi.bodyTruncated');
    expect(truncated.container.textContent).toContain('crawlDeepUi.noLocalRuleFindings');
  });

  it('renders direct findings, evidence and the bounded-result note', () => {
    show(
      {
        charset: 'UTF-8',
        detected_charset: 'UTF-8',
        html_validation_truncated: true,
        html_validation_findings: [{ code: 'unclosed-tag' }],
      },
      [
        {
          code: 'unclosed-tag',
          severity: 'Error',
          message: 'Unclosed div',
          element: 'div',
          attribute: 'class',
          value: 'content',
          line: 12,
          column: 4,
          source_excerpt: '<div>',
        },
        { code: 'missing-alt', severity: 'Warning', message: 'Missing alt' },
      ],
    );

    expect(screen.getAllByText('UTF-8')).toHaveLength(2);
    expect(screen.getByText(/crawlDeepUi\.findingCountShort/)).toBeTruthy();
    expect(screen.getByText(/crawlDeepUi\.limitedResult/)).toBeTruthy();
    expect(screen.getByText('crawlDeepUi.validationTruncatedNote')).toBeTruthy();
    expect(screen.getAllByText(/unclosed-tag/)).toHaveLength(2);
    expect(screen.getByText('Unclosed div')).toBeTruthy();
    expect(screen.getAllByText(/<div>/)).toHaveLength(2);
  });

  it('omits the limited-result marker for complete findings', () => {
    show({ html_validation_findings: [], html_validation_truncated: false }, [
      { code: 'valid', severity: 'Warning', message: 'Complete result' },
    ]);
    expect(screen.getByText(/crawlDeepUi\.findingCountShort/)).toBeTruthy();
    expect(screen.queryByText('crawlDeepUi.limitedResult')).toBeNull();
    expect(screen.queryByText('crawlDeepUi.validationTruncatedNote')).toBeNull();
  });
});
