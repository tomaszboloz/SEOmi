import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { AioPassageCard } from '@/components/Domain/crawlResults/aio/AioPassageCard';
import { AioPassageEvidence } from '@/components/Domain/crawlResults/aio/AioPassageEvidence';
import type { AioChunk } from '@/services/aioReadiness';

const passage = (extra: Partial<AioChunk> = {}): AioChunk & { url: string } => ({
  url: 'https://site.test/guide',
  heading: 'Guide',
  level: 2,
  text: 'This passage names the guide and includes a concrete fact.',
  tokens: 12,
  windowIndex: 0,
  score: 42,
  selfContainment: 0.4,
  answerFirst: 0.8,
  answerFirstAvailability: 'available',
  spoDensity: 0.25,
  triples: 2,
  issues: [],
  ...extra,
});

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('AioPassageEvidence', () => {
  it('renders supplied UTF-16 offsets, score components, facts and existing spans', () => {
    render(<AioPassageEvidence passage={passage({
      offsets: { start: 12, end: 68, unit: 'utf16' },
      selfContainmentDetails: {
        score: 0.4,
        dangling: 1,
        deictic: 1,
        noEntity: false,
        anchorStatus: 'known',
        reasons: [],
        spans: [
          { kind: 'dangling', start: 0, end: 4 },
          { kind: 'deictic', start: 20, end: 24 },
          { kind: 'no-entity', start: 30, end: 35 },
        ],
      },
    })} />);

    expect(screen.getByTestId('aio-passage-offset').textContent).toContain('source chars 12–68');
    expect(screen.getByTestId('aio-passage-evidence').textContent).toContain('42%');
    expect(screen.getByTestId('aio-passage-evidence').textContent).toContain('40%');
    expect(screen.getByTestId('aio-passage-evidence').textContent).toContain('25%');
    expect(screen.getByTestId('aio-passage-evidence').textContent).toContain('80%');
    expect(screen.getByTestId('aio-passage-evidence').textContent).toContain('Detected SPO relations2');
    expect(screen.getByTestId('aio-passage-spans').textContent).toContain('Unclear reference · 0–4');
    expect(screen.getByTestId('aio-passage-spans').textContent).toContain('Context-dependent reference · 20–24');
    expect(screen.getByTestId('aio-passage-spans').textContent).toContain('Subject or entity not named · 30–35');
    expect(screen.getAllByTestId('aio-passage-highlight').length).toBe(3);
    expect(screen.getAllByTestId('aio-passage-highlight')[0].getAttribute('title')).toBe('Unclear reference');
  });

  it('does not invent offsets or values when evidence is unavailable', () => {
    render(<AioPassageEvidence passage={passage({
      score: undefined as never,
      spoDensity: undefined,
      answerFirst: 1,
      answerFirstAvailability: 'not-applicable',
      triples: undefined as never,
    })} />);

    expect(screen.getByTestId('aio-passage-offset').textContent).toBe('Source offset unavailable');
    expect(screen.getByTestId('aio-passage-evidence').textContent).toContain('Scoreunknown');
    expect(screen.getByTestId('aio-passage-evidence').textContent).toContain('Fact densityunknown');
    expect(screen.getByTestId('aio-passage-evidence').textContent).toContain('Answer-firstn/a');
    expect(screen.getByTestId('aio-passage-evidence').textContent).toContain('Detected SPO relationsunknown');
    expect(screen.queryByTestId('aio-passage-spans')).toBeNull();
  });

  it('keeps score units explicit at zero and one boundaries', () => {
    const { rerender } = render(<AioPassageEvidence passage={passage({ score: 1, selfContainment: 1, spoDensity: 1, answerFirst: 1 })} />);
    expect(screen.getByText('1%', { exact: true })).toBeTruthy();
    expect(screen.getAllByText('100%', { exact: true })).toHaveLength(3);
    rerender(<AioPassageEvidence passage={passage({ score: 0, selfContainment: 0, spoDensity: 0, answerFirst: 0 })} />);
    expect(screen.getAllByText('0%', { exact: true })).toHaveLength(4);
  });

  it('highlights valid UTF-16 ranges, merges overlap, and diagnoses invalid ranges safely', () => {
    const text = 'A😀 <b>x</b> Z';
    const literalEnd = text.indexOf('</b>') + 4;
    const { container } = render(<AioPassageEvidence passage={passage({ text, selfContainmentDetails: {
      score: 0.5, dangling: 1, deictic: 0, noEntity: false, anchorStatus: 'known', reasons: [], spans: [
        { kind: 'dangling', start: 1, end: 3 },
        { kind: 'deictic', start: 1, end: literalEnd },
        { kind: 'deictic', start: 2, end: 3 },
        { kind: 'no-entity', start: -1, end: 2 },
        { kind: 'dangling', start: 0, end: text.length + 1 },
      ],
    } })} />);

    const highlighted = screen.getByTestId('aio-passage-text');
    expect(highlighted.textContent).toContain('😀 <b>x</b>');
    expect(highlighted.querySelector('b')).toBeNull();
    expect(screen.getAllByTestId('aio-passage-highlight').length).toBe(1);
    expect(screen.getByTestId('aio-passage-invalid-spans').textContent).toContain('3 invalid span(s)');
    const sections = container.querySelectorAll('[data-testid="aio-passage-evidence"]');
    expect(sections[0].getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('gives repeated cards distinct evidence heading ids', () => {
    const { container } = render(<><AioPassageEvidence passage={passage()} /><AioPassageEvidence passage={passage()} /></>);
    const sections = [...container.querySelectorAll('[data-testid="aio-passage-evidence"]')];
    const ids = sections.map((section) => section.getAttribute('aria-labelledby'));
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => id && container.querySelector(`#${CSS.escape(id)}`))).toBe(true);
  });

  it('renders the visible passage text exactly once in the complete card', () => {
    render(<AioPassageCard passage={passage()} index={0} />);
    const text = screen.getByTestId('aio-passage').textContent ?? '';
    expect(text.match(/This passage names the guide and includes a concrete fact\./g)).toHaveLength(1);
  });
});
