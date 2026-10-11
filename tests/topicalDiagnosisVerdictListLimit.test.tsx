import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { DiagnosisVerdictList } from '@/components/Charts/crawlArchitecture/topicalDiagnosis/DiagnosisVerdictList';
import type { DiagnosisVerdict } from '@/services/topicalDiagnosis';

const orphans = (count: number): DiagnosisVerdict[] => Array.from({ length: count }, (_, index) => ({
  id: `document-orphan:doc-${index}`, code: 'document-orphan', severity: 'fix', scope: 'document', scopeId: `doc-${index}`,
  urls: [`https://ex.test/blog/post-${index}/`], evidence: [], confidence: 'moderate',
}));
const thin: DiagnosisVerdict = {
  id: 'topic-thin:topic-0', code: 'topic-thin', severity: 'weak', scope: 'topic', scopeId: 'topic-0', urls: [], evidence: [], confidence: 'moderate',
};
const cards = () => screen.queryAllByText('Brak jakiegokolwiek linku z treści').length;

describe('verdict list beyond the first screenful', () => {
  beforeEach(async () => { await i18n.changeLanguage('pl'); });

  it('says how many verdicts are not rendered and shows them on request', () => {
    render(<DiagnosisVerdictList verdicts={[...orphans(130), thin]} onOpenPage={() => undefined} />);

    expect(cards()).toBe(120);
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż pozostałe werdykty (11)' }));

    expect(cards()).toBe(130);
    expect(screen.getByText('Cienki temat')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Pokaż pozostałe werdykty/ })).toBeNull();
  });

  it('counts the rest within the chosen severity', () => {
    render(<DiagnosisVerdictList verdicts={[...orphans(125), thin]} onOpenPage={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Do poprawy · 125' }));

    expect(screen.getByRole('button', { name: 'Pokaż pozostałe werdykty (5)' })).toBeTruthy();
  });

  it('offers nothing when every verdict fits', () => {
    render(<DiagnosisVerdictList verdicts={orphans(120)} onOpenPage={() => undefined} />);

    expect(cards()).toBe(120);
    expect(screen.queryByRole('button', { name: /Pokaż pozostałe werdykty/ })).toBeNull();
  });
});
