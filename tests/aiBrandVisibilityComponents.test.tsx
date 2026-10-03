import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { getSentimentBadge } from '@/components/AiVisibility/brandVisibility/brandVisibilityTypes';
import { AiBrandHeader } from '@/components/AiVisibility/brandVisibility/AiBrandHeader';
import { AiBrandInputForm } from '@/components/AiVisibility/brandVisibility/AiBrandInputForm';
import { AiBrandOverviewCards } from '@/components/AiVisibility/brandVisibility/AiBrandOverviewCards';
import { AiBrandModelsGrid } from '@/components/AiVisibility/brandVisibility/AiBrandModelsGrid';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts.count !== 'undefined') return `${key}:${opts.count}`;
  return key;
}) as any;

describe('AiBrandVisibility modular architecture', () => {
  it('satisfies physical LOC <= 150 across AiBrandVisibility and submodules', () => {
    const files = [
      'src/components/AiVisibility/AiBrandVisibility.tsx',
      ...codeFiles('src/components/AiVisibility/brandVisibility'),
    ];
    expect(files.length).toBe(8);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('getSentimentBadge maps sentiment string to styling classes', () => {
    expect(getSentimentBadge('positive')).toContain('emerald');
    expect(getSentimentBadge('negative')).toContain('rose');
    expect(getSentimentBadge('neutral')).toContain('blue');
    expect(getSentimentBadge('unknown')).toContain('slate');
  });

  it('renders AiBrandHeader with connected providers', () => {
    render(<AiBrandHeader connectedProvidersCount={2} t={mockT} />);
    expect(screen.getByText('aiVisibility.brand.title')).toBeTruthy();
    expect(screen.getByText('aiVisibility.brand.connected:2')).toBeTruthy();
  });

  it('renders AiBrandInputForm and handles inputs', () => {
    const onChangeBrand = vi.fn();
    const onChangeDomain = vi.fn();
    const onSubmit = vi.fn();

    render(
      <AiBrandInputForm
        brand="SEOmi"
        domain="seomi.org"
        prompts="what is seomi"
        competitors="ahrefs"
        researchSettings={{ prompts: ['what is seomi'], competitors: ['ahrefs'], repetitions: 2 }}
        isLoading={false}
        onChangeBrand={onChangeBrand}
        onChangeDomain={onChangeDomain}
        onChangePrompts={vi.fn()}
        onChangeCompetitors={vi.fn()}
        onUpdateResearchSettings={vi.fn()}
        onSubmit={onSubmit}
        t={mockT}
      />,
    );

    const brandInput = screen.getByRole('textbox', { name: /aiVisibility.brand.brandLabel/i });
    fireEvent.change(brandInput, { target: { value: 'SEOmi Pro' } });
    expect(onChangeBrand).toHaveBeenCalledWith('SEOmi Pro');

    const domainInput = screen.getByRole('textbox', { name: /aiVisibility.brand.domainLabel/i });
    fireEvent.change(domainInput, { target: { value: 'https://seomi.org' } });
    expect(onChangeDomain).toHaveBeenCalledWith('https://seomi.org');
  });

  it('renders AiBrandOverviewCards and AiBrandModelsGrid', () => {
    const mockReport: any = {
      overall_score: 85,
      methodology: true,
      share_of_voice: 42,
      timestamp: '2026-02-01T12:00:00Z',
      key_takeaways: ['Consistently cited by models for speed'],
      models: [
        {
          model_name: 'gpt-4o',
          provider: 'openai',
          sentiment: 'positive',
          is_present: true,
          response_status: 'ok',
          captured_at: '2026-02-01T12:00:00Z',
          summary: 'Recognized as leading desktop SEO audit tool.',
          cited_sources: ['https://seomi.org'],
        },
      ],
    };

    render(
      <div>
        <AiBrandOverviewCards report={mockReport} t={mockT} />
        <AiBrandModelsGrid report={mockReport} history={[]} onSelectReport={vi.fn()} t={mockT} />
      </div>,
    );

    expect(screen.getByText('85%')).toBeTruthy();
    expect(screen.getByText('Consistently cited by models for speed')).toBeTruthy();
    expect(screen.getByText('gpt-4o')).toBeTruthy();
    expect(screen.getByText('https://seomi.org')).toBeTruthy();
  });
});
