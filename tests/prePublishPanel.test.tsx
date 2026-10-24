import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrePublishPanel } from '@/components/Charts/PrePublishPanel';
import type { PrePublishReport } from '@/services/prePublish/check';

const base: PrePublishReport = { verdict: 'insufficient', publishApproved: false, draftTrs: null, sfsBefore: null, sfsAfter: null, sfsDelta: null, conflicts: [], chunkIssues: [], reasons: [] };

describe('PrePublishPanel', () => {
  it('shows only the verdict when there is no evidence', () => {
    const { container } = render(<PrePublishPanel report={{ ...base, reasons: ['no-core'] }} />);
    expect(container.textContent).toContain('prePublishUi.verdict.insufficient');
    expect(container.textContent).toContain('prePublishUi.reason.no-core');
    expect(container.textContent).not.toContain('prePublishUi.sfs');
  });
  it('shows delta, conflicts and chunk issues', () => {
    const report: PrePublishReport = { ...base, verdict: 'blocked', draftTrs: 70, sfsBefore: 60, sfsAfter: 62, sfsDelta: 2, conflicts: [{ url: 'u', similarity: 0.9, level: 'conflict' }, { url: 'w', similarity: 0.86, level: 'overlap' }], chunkIssues: [{ index: 0, kind: 'too-short' }], reasons: ['cannibalization'] };
    const { container } = render(<PrePublishPanel report={report} />);
    expect(container.textContent).toContain('prePublishUi.conflict');
    expect(container.textContent).toContain('prePublishUi.overlap');
    expect(container.textContent).toContain('prePublishUi.chunk.too-short');
    const down = render(<PrePublishPanel report={{ ...report, sfsDelta: -1 }} />);
    expect(down.container.textContent).toContain('prePublishUi.sfs');
  });
});
