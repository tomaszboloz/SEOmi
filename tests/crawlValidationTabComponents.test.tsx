import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrawlValidationTab } from '@/components/Domain/crawlResults/CrawlValidationTab';
import { ValidationFilterBar } from '@/components/Domain/crawlResults/validationTab/ValidationFilterBar';
import { ValidationTable } from '@/components/Domain/crawlResults/validationTab/ValidationTable';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts === 'object') {
    return `${key} ${JSON.stringify(opts)}`;
  }
  return key;
}) as any;

describe('CrawlValidationTab modular architecture', () => {
  it('satisfies physical LOC <= 150 across validationTab files', () => {
    const files = [
      'src/components/Domain/crawlResults/CrawlValidationTab.tsx',
      ...codeFiles('src/components/Domain/crawlResults/validationTab'),
    ];
    expect(files.length).toBe(7);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders empty state when no pages were checked for validation', () => {
    const session = {
      result: { pages: [{ url: 'https://example.com' }] },
      validationQuery: '',
      validationSeverity: 'all',
      setValidationQuery: vi.fn(),
      setValidationSeverity: vi.fn(),
      t: mockT,
    } as any;

    render(<CrawlValidationTab session={session} />);
    expect(screen.getByText('crawlDeepUi.noValidationResults')).toBeTruthy();
  });

  it('renders ValidationFilterBar and responds to search and clear actions', () => {
    const setValidationQuery = vi.fn();
    const setValidationSeverity = vi.fn();

    render(
      <ValidationFilterBar
        validationQuery="unclosed"
        setValidationQuery={setValidationQuery}
        validationSeverity="Error"
        setValidationSeverity={setValidationSeverity}
        pagesCount={2}
        findingsCount={5}
        t={mockT}
      />,
    );

    const input = screen.getByLabelText('crawl.ui.searchHtmlValidation');
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: 'tag' } });
    expect(setValidationQuery).toHaveBeenCalledWith('tag');

    const clearBtn = screen.getByText('crawlDeepUi.clearFilter');
    fireEvent.click(clearBtn);
    expect(setValidationQuery).toHaveBeenCalledWith('');
    expect(setValidationSeverity).toHaveBeenCalledWith('all');
  });

  it('renders ValidationTable with findings and charset evidence', () => {
    const validationPages = [
      {
        page: {
          url: 'https://example.com/broken',
          charset: 'utf-8',
          detected_charset: 'utf-8',
          html_validation_findings: [],
        },
        findings: [
          {
            code: 'unclosed-tag',
            severity: 'Error',
            message: 'Unclosed div tag',
            element: 'div',
            attribute: 'class',
            value: 'container',
            line: 42,
            column: 10,
            source_excerpt: '<div class="container">',
          },
        ],
        pageMatches: true,
      },
    ];

    render(<ValidationTable validationPages={validationPages as any} t={mockT} />);
    expect(screen.getByText('https://example.com/broken')).toBeTruthy();
    expect(screen.getAllByText('utf-8').length).toBe(2);
    expect(screen.getAllByText(/unclosed-tag/).length).toBeGreaterThanOrEqual(1);
  });
});
