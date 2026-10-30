import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { AioPassageFacts } from '@/components/Domain/crawlResults/aio/AioPassageFacts';
import { rulesFor, scoreChunk, type AioChunk } from '@/services/aioReadiness';

const base: AioChunk = { heading: 'Dosage', level: 2, text: 'x', tokens: 1, windowIndex: 0, score: 50, selfContainment: 1, answerFirst: 1, triples: 0, issues: [] };

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('AioPassageFacts (#64)', () => {
  it('shows SPO facts with quality, unit and negation plus Answer-First components', () => {
    render(<AioPassageFacts passage={{
      ...base,
      spoTriples: [
        { subject: 'Ibuprofen', predicate: 'is', object: '200 mg per tablet', quality: 1, unit: 'mg', negated: false },
        { subject: 'The drug', predicate: 'is', object: 'not safe for children', quality: 0.3, negated: true },
      ],
      answerFirstDetails: { similarity: 0.5, declarative: 1, fluff: 0 },
    }} />);
    const list = screen.getByTestId('aio-spo-list');
    expect(list.textContent).toContain('Ibuprofen · is · 200 mg per tablet');
    expect(list.textContent).toContain('Q 1');
    expect(list.textContent).toContain('unit mg');
    expect(list.querySelectorAll('[data-negated="true"]')).toHaveLength(1);
    expect(screen.getByTestId('aio-answer-components').textContent).toBe('Answer-First components: heading match 50% · declarative lead yes · filler opening no');
  });

  it('renders nothing for chunks stored before the inspector detail existed', () => {
    const { container } = render(<AioPassageFacts passage={base} />);
    expect(container.innerHTML).toBe('');
  });

  it('says explicitly when no facts were detected', () => {
    render(<AioPassageFacts passage={{ ...base, spoTriples: [] }} />);
    expect(screen.getByTestId('aio-passage-facts').textContent).toContain('No subject-predicate-object facts detected');
    expect(screen.queryByTestId('aio-answer-components')).toBeNull();
  });

  it('scoreChunk exposes triples and Answer-First detail, and omits the detail for continuation windows', () => {
    const { rules } = rulesFor('en');
    const raw = { heading: 'Ibuprofen dosage', level: 2, paragraphs: ['Ibuprofen dosage is 200 mg for adults every eight hours with food and water.'], tokens: 14, windowIndex: 0 };
    const first = scoreChunk(raw, rules);
    expect(first.spoTriples?.length).toBeGreaterThan(0);
    expect(first.spoTriples?.[0]).toMatchObject({ quality: 1, unit: 'mg' });
    expect(first.answerFirstDetails).toBeDefined();
    expect(scoreChunk({ ...raw, windowIndex: 1 }, rules).answerFirstDetails).toBeUndefined();
  });
});
