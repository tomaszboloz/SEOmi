import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BriefQuality } from '@/components/Charts/contentBrief/BriefQuality';
import { BriefAeo } from '@/components/Charts/contentBrief/BriefAeo';
import { briefLabel as label, briefModel } from './fixtures/briefUiContracts';

describe('brief advisory indicator presentation', () => {
  it('shows quality recommendations and the no-signal state with the methodology', () => {
    const model = briefModel();
    const view = render(<BriefQuality model={model} />);
    expect(screen.getAllByRole('listitem').map((item) => item.textContent))
      .toEqual(model.assessment.draftQuality.recommendations.map((item) => `· ${item}`));
    expect(screen.getByText(model.assessment.draftQuality.methodology, { exact: false })).toBeTruthy();
    model.assessment.draftQuality.recommendations = [];
    view.rerender(<BriefQuality model={model} />);
    expect(screen.getByText(label('noQualitySignals'))).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('shows bounded AEO recommendations, observed types and valid/invalid outlines', () => {
    const model = briefModel();
    model.assessment.aeoReadiness.recommendations = Array.from({ length: 6 }, (_, i) => `Recommendation ${i}`);
    const view = render(<BriefAeo model={model} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByLabelText(label('outlineAria')).textContent).toBe(label('outlineValid'));
    expect(screen.getByText(label('answeredQuestions', { answered: 0, total: 0, types: label('noData') }))).toBeTruthy();
    model.assessment.aeoReadiness.schemaTypesObserved = ['Article'];
    model.assessment.aeoReadiness.outlineIssues = ['Missing heading'];
    model.assessment.aeoReadiness.recommendations = [];
    view.rerender(<BriefAeo model={model} />);
    expect(screen.getByLabelText(label('outlineAria')).textContent).toContain('Missing heading');
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText(label('answeredQuestions', { answered: 0, total: 0, types: 'Article' }))).toBeTruthy();
  });
});
