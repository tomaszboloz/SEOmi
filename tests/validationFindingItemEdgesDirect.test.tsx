import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ValidationFindingItem } from '@/components/Domain/crawlResults/validationTab/ValidationFindingItem';
import type { CrawledHtmlValidationFinding } from '@/types';

const t = ((key: string) => key) as never;

describe('validation finding item edge contracts', () => {
  it('renders a positioned finding without a column and handles element-only evidence', () => {
    const finding: CrawledHtmlValidationFinding = {
      code: 'html-doctype-invalid', severity: 'Error', message: 'Broken doctype', element: 'html', line: 7,
    };
    render(<ul><ValidationFindingItem finding={finding} t={t} /></ul>);

    expect(screen.getByText(/crawlDeepUi\.line/).textContent).toContain('7');
    expect(screen.getByText('htmlValidationFindings.messageDoctypeInvalid')).toBeTruthy();
    expect(screen.getByText('<html>')).toBeTruthy();
    expect(screen.getByText('Broken doctype')).toBeTruthy();
  });

  it('renders warning attribute-only evidence without inventing an element or value', () => {
    const finding: CrawledHtmlValidationFinding = {
      code: 'custom-warning', severity: 'Warning', message: 'Observed warning', attribute: 'alt',
    };
    render(<ul><ValidationFindingItem finding={finding} t={t} /></ul>);

    const item = screen.getByRole('listitem');
    expect(item.className).toContain('border-amber-500');
    expect(screen.getByText('htmlValidationFindings.messageGeneric')).toBeTruthy();
    expect(screen.getByText('[alt]')).toBeTruthy();
    expect(screen.queryByText(/<undefined>/)).toBeNull();
  });
});
