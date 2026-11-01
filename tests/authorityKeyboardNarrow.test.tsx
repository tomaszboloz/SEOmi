import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { CoverageMap } from '@/components/Domain/crawlResults/authority/CoverageMap';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

afterEach(cleanup);
const pages = ownSite();
const taxonomy = referenceTaxonomy(pages)!;
const base = buildAuthorityReport(pages, `https://${OWN_HOST}/`, ownReport(pages), { taxonomy, now: NOW });
const LONG = 'Extraordinarily-long-unbroken-subtopic-label-'.repeat(8);
const report = { ...base, coverage: [...base.coverage, ...base.coverage.map((row, index) => ({ ...row, subtopicId: `${row.subtopicId}-copy${index}`, label: LONG }))] };

describe('coverage map keyboard and narrow window (#60 GEM-60-07/T05)', () => {
  it('reaches every control through native focusable elements with names, in DOM order, without positive tabindex', () => {
    const onSelect = vi.fn();
    const { container } = render(<CoverageMap report={report} onSelect={onSelect} />);
    const controls = [...container.querySelectorAll<HTMLElement>('button, select, input, [tabindex]')];
    expect(controls.length).toBeGreaterThan(report.coverage.length);
    controls.forEach((element) => {
      expect(['BUTTON', 'SELECT', 'INPUT']).toContain(element.tagName);
      expect(Number(element.getAttribute('tabindex') ?? 0)).toBeLessThanOrEqual(0);
      expect((element.getAttribute('aria-label') ?? element.textContent ?? '').trim().length).toBeGreaterThan(0);
    });
    expect(container.querySelectorAll('[onclick], div[role="button"]')).toHaveLength(0);
    const first = screen.getAllByRole('button').at(-1)!;
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.click(first);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('keeps long unbroken names inside a narrow column and lets controls wrap', () => {
    const { container } = render(<CoverageMap report={report} onSelect={vi.fn()} />);
    const label = screen.getAllByText(LONG)[0];
    expect(label.className).toMatch(/min-w-0/);
    expect(label.className).toMatch(/break-words/);
    expect(label.closest('button')!.className).toMatch(/flex-wrap/);
    expect(container.querySelector('[role="group"]')!.className).toMatch(/flex-wrap/);
    expect(container.querySelectorAll('.flex-wrap').length).toBeGreaterThanOrEqual(3);
  });

  it('marks the active filter for assistive technology', () => {
    render(<CoverageMap report={report} onSelect={vi.fn()} />);
    const pressed = screen.getAllByRole('button').filter((button) => button.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    const other = screen.getAllByRole('button').find((button) => button.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(other);
    expect(other.getAttribute('aria-pressed')).toBe('true');
  });
});
