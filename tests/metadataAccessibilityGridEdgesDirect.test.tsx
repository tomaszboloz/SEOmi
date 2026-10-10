import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetadataAccessibilityGrid } from '@/components/Results/metadata/MetadataAccessibilityGrid';
import type { PageAuditData } from '@/types';
import i18n from '@/i18n';
import { createAuditFixture } from './fixtures/audit';

const audit = (accessibility: PageAuditData['accessibility']): PageAuditData =>
  createAuditFixture({ accessibility });

describe('metadata accessibility grid edge contracts', () => {
  it('renders observed language, counts and landmark evidence', () => {
    render(<MetadataAccessibilityGrid audit={audit({
      document_language: 'pl', landmarks: [{ name: 'main', count: 1 }],
      aria_attribute_count: 4, form_control_count: 5, unlabeled_form_control_count: 2,
      manual_review_items: [],
    })} />);

    expect(screen.getByText('pl')).toBeTruthy();
    expect(screen.getByText('2 / 5')).toBeTruthy();
    expect(screen.getByText('main (1)')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('shows explicit fallbacks for legacy audits without accessibility data', () => {
    render(<MetadataAccessibilityGrid audit={audit(undefined)} />);

    expect(screen.getByText(i18n.t('accessibility.missingLang'))).toBeTruthy();
    expect(screen.getByText('0 / 0')).toBeTruthy();
    expect(screen.getByText(i18n.t('accessibility.noLandmarks'))).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });
});
