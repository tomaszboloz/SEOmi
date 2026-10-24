import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { ExperimentsPanel } from '@/components/Charts/ExperimentsPanel';
import { addIntervention, listInterventions } from '@/services/experiments/registry';
import type { CrawledPageSummary } from '@/types';
import { experimentNow, experimentUrl, intervention, savedExperimentPair } from './fixtures/experiments';

const pages = [{ url: experimentUrl }, { url: experimentUrl }] as CrawledPageSummary[];
beforeEach(async () => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(experimentNow);
  await i18n.changeLanguage('en');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

const addFromForm = (url = experimentUrl, date = '2026-09-11') => {
  fireEvent.change(screen.getByLabelText('Page URL'), { target: { value: url } });
  fireEvent.change(screen.getByLabelText('First day affected'), { target: { value: date } });
  fireEvent.change(screen.getByLabelText('Intervention type'), { target: { value: 'title-meta' } });
  fireEvent.change(screen.getByLabelText('Note (up to 300 characters)'), { target: { value: 'New page title' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Add intervention' }));
};

describe('SEO experiments panel', () => {
  it('requires a project and always shows the observation disclaimer', () => {
    render(<ExperimentsPanel projectId={null} pages={pages} />);
    expect(screen.getByText('Select a project to register interventions.')).toBeTruthy();
    expect(screen.getByText(/This is an observation, not proof of causation/)).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('adds a crawl URL intervention, evaluates saved snapshots, persists and removes it', () => {
    savedExperimentPair();
    render(<ExperimentsPanel projectId="p1" pages={pages} />);
    expect(screen.getByText('No interventions registered.')).toBeTruthy();
    expect(screen.getAllByRole('option', { name: experimentUrl })).toHaveLength(1);
    expect(screen.getByLabelText('Note (up to 300 characters)').getAttribute('maxlength')).toBe('300');
    addFromForm();
    expect(listInterventions('p1')).toHaveLength(1);
    expect(listInterventions('p1')[0]).toMatchObject({ url: experimentUrl, kind: 'title-meta', note: 'New page title' });
    expect((screen.getByLabelText('Note (up to 300 characters)') as HTMLTextAreaElement).value).toBe('');
    const card = within(screen.getByRole('article'));
    expect(card.getByRole('status').textContent).toBe('Observation available');
    expect(card.getByText(/2026-09-01 – 2026-09-10/)).toBeTruthy();
    expect(card.getByText(/2026-09-11 – 2026-09-20/)).toBeTruthy();
    expect(card.getAllByText(/: \+50 pp$/)).toHaveLength(2);
    expect(card.getByText('-3')).toBeTruthy();
    expect(card.getByText('Rest of site (totals minus page)')).toBeTruthy();
    expect(card.getByText('Clicks: 60 → 60 · 0%')).toBeTruthy();
    fireEvent.click(card.getByRole('button', { name: 'Remove intervention' }));
    expect(screen.queryByRole('article')).toBeNull();
    expect(listInterventions('p1')).toEqual([]);
  });

  it('shows planned status for future dates without manufacturing periods', () => {
    render(<ExperimentsPanel projectId="p1" pages={pages} />);
    addFromForm('site', '2099-01-01');
    expect(screen.getByRole('status').textContent).toBe('Planned / pending');
    expect(screen.getByText(/The intervention date is in the future/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows missing snapshot reasons and restores saved interventions after remount', () => {
    addIntervention('p1', { ...intervention, note: '' });
    const view = render(<ExperimentsPanel projectId="p1" pages={[]} />);
    expect(screen.getByRole('status').textContent).toBe('Inconclusive');
    expect(screen.getByText('No saved period ends before the intervention.')).toBeTruthy();
    expect(screen.getByText('No saved period starts on or after the intervention.')).toBeTruthy();
    view.unmount();
    render(<ExperimentsPanel projectId="p1" pages={[]} />);
    expect(screen.getByRole('article')).toBeTruthy();
  });

  it('isolates project entries and resets the form when switching project', () => {
    addIntervention('p1', intervention);
    const view = render(<ExperimentsPanel projectId="p1" pages={pages} />);
    expect(screen.getByRole('article')).toBeTruthy();
    view.rerender(<ExperimentsPanel projectId="p2" pages={[]} />);
    expect(screen.queryByRole('article')).toBeNull();
    expect((screen.getByLabelText('Page URL') as HTMLSelectElement).value).toBe('site');
    expect(screen.getAllByRole('option', { name: 'Whole site' })).toHaveLength(1);
  });

  it('does not claim failed writes succeeded and preserves failed removals', () => {
    addIntervention('p1', intervention);
    render(<ExperimentsPanel projectId="p1" pages={pages} />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    addFromForm();
    expect(screen.getByText(/Could not save/)).toBeTruthy();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect((screen.getByLabelText('Note (up to 300 characters)') as HTMLTextAreaElement).value).toBe('New page title');
    fireEvent.click(screen.getByRole('button', { name: 'Remove intervention' }));
    expect(screen.getByText(/Could not remove the intervention/)).toBeTruthy();
    expect(screen.getByRole('article')).toBeTruthy();
  });
});
