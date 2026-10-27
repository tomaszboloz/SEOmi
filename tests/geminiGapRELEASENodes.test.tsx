import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { useAuditStore } from '@/stores/auditStore';
import { DataForSeoSummaryCard } from '@/components/Results/dataforseoAudit/DataForSeoSummaryCard';
import { MetadataAccessibilityFindings } from '@/components/Results/metadata/MetadataAccessibilityFindings';
import type { AccessibilityAudit } from '@/types';
import { createAuditFixture } from './fixtures/audit';

const a11yFixture = (patch: Partial<AccessibilityAudit> = {}): AccessibilityAudit => ({
  landmarks: [],
  aria_attribute_count: 0,
  form_control_count: 0,
  unlabeled_form_control_count: 0,
  manual_review_items: [],
  ...patch,
});

describe('RELEASE DataForSeoSummaryCard and MetadataAccessibilityFindings branch coverage', () => {
  const initialAuditState = useAuditStore.getState();

  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    useAuditStore.setState(initialAuditState, true);
  });

  it('covers DataForSeoSummaryCard line 33 dofollowRatio null vs computed branches', () => {
    // Branch 1: dofollowRatio is null (no data or zero backlinks) -> shows runLiveMetric
    useAuditStore.setState({ dataforseoData: undefined });
    const { rerender } = render(<DataForSeoSummaryCard />);
    expect(screen.getByText('Run a live request to load this metric.')).toBeTruthy();

    // Branch 2: dofollowRatio is computed (total: 200, dofollow: 150 -> 75%) -> shows percentage
    useAuditStore.setState({
      dataforseoData: {
        total_backlinks: 200,
        dofollow_backlinks: 150,
        referring_domains: 25,
        referring_main_domains: 20,
        rank: 60,
        broken_backlinks: 0,
      } as never,
    });
    rerender(<DataForSeoSummaryCard />);
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.queryByText('Run a live request to load this metric.')).toBeNull();
  });

  it('covers MetadataAccessibilityFindings line 58 shownCount condition branches', () => {
    // Branch 1: finding.code is unlabeled form controls AND elements.length (1) < unlabeled_form_control_count (4) -> renders shownCount
    const auditTruncated = createAuditFixture({
      accessibility: a11yFixture({
        unlabeled_form_control_count: 4,
        findings: [{
          code: 'accessibility-form-controls-unlabeled', severity: 'warning', message: 'Unlabeled form controls',
          evidence: '4 controls', recommendation: 'Associate every control with label[for].',
          elements: [{ dom_position: 1, dom_query: 'input#email', html_snippet: '<input id="email" />' }],
        }],
      }),
    });
    const { rerender } = render(<MetadataAccessibilityFindings audit={auditTruncated} />);
    expect(screen.getByText('Shown 1 of 4 elements; the stored report limit is 50.')).toBeTruthy();

    // Branch 2: elements.length (1) >= unlabeled_form_control_count (1) -> does NOT render shownCount
    const auditComplete = createAuditFixture({
      accessibility: a11yFixture({
        unlabeled_form_control_count: 1,
        findings: [{
          code: 'accessibility-form-controls-unlabeled', severity: 'warning', message: 'Unlabeled form controls',
          evidence: '1 control', recommendation: 'Associate every control with label[for].',
          elements: [{ dom_position: 1, dom_query: 'input#email', html_snippet: '<input id="email" />' }],
        }],
      }),
    });
    rerender(<MetadataAccessibilityFindings audit={auditComplete} />);
    expect(screen.queryByText('Shown 1 of 4 elements; the stored report limit is 50.')).toBeNull();

    // Branch 3: unlabeled_form_control_count is undefined (tests ?? 0 fallback)
    const auditMissingCount = createAuditFixture({
      accessibility: a11yFixture({
        unlabeled_form_control_count: undefined as never,
        findings: [{
          code: 'accessibility-form-controls-unlabeled', severity: 'warning', message: 'Unlabeled form controls',
          evidence: '0 controls', recommendation: 'Associate every control with label[for].',
          elements: [{ dom_position: 1, dom_query: 'input#email', html_snippet: '<input id="email" />' }],
        }],
      }),
    });
    rerender(<MetadataAccessibilityFindings audit={auditMissingCount} />);
    expect(screen.queryByText(/Shown 1 of/)).toBeNull();

    // Branch 4: different finding code -> does NOT render shownCount
    const auditOther = createAuditFixture({
      accessibility: a11yFixture({
        findings: [{
          code: 'accessibility-document-language-missing', severity: 'error', message: 'Language missing',
          evidence: '', recommendation: 'Add a lang attribute to html tag.',
          elements: [{ dom_position: 1, dom_query: 'html', html_snippet: '<html>' }],
        }],
      }),
    });
    rerender(<MetadataAccessibilityFindings audit={auditOther} />);
    expect(screen.queryByText(/Shown 1 of/)).toBeNull();
  });
});
