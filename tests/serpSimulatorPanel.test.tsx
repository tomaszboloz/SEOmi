import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { SerpSimulatorPanel } from '@/components/SeoTools/workspace/SerpSimulatorPanel';
import { simulatorStorageKey } from '@/components/SeoTools/workspace/seoToolsTypes';
import { useProjectStore } from '@/stores/projectStore';

const projects = [
  { id: 'p1', name: 'One', rootUrl: 'https://one.test/' },
  { id: 'p2', name: 'Two' },
];
const label = (key: string) => screen.getByLabelText(i18n.t(key)) as HTMLInputElement;
const select = (id: string | null) => useProjectStore.setState({ projects: projects as never, activeProjectId: id });

beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.clear();
  select('p1');
});

describe('SerpSimulatorPanel', () => {
  it('defaults the URL to the project root and previews placeholders', () => {
    render(<SerpSimulatorPanel />);
    expect(label('seoTools.serpUrl').value).toBe('https://one.test/');
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(i18n.t('seoTools.serpTitle'));
    expect(screen.getAllByText(i18n.t('seoTools.characterCount', { count: 0 }), { exact: false }).length).toBeGreaterThan(0);
  });

  it('shows the not-available label when there is no URL at all', () => {
    select('p2');
    render(<SerpSimulatorPanel />);
    expect(screen.getByText(i18n.t('seoTools.notAvailable'))).toBeTruthy();
  });

  it('previews edits with character counts and persists them per project', () => {
    render(<SerpSimulatorPanel />);
    fireEvent.change(label('seoTools.serpTitle'), { target: { value: 'Hello' } });
    fireEvent.change(label('seoTools.serpDescription'), { target: { value: 'Longer text' } });
    fireEvent.change(label('seoTools.serpUrl'), { target: { value: 'https://x.test' } });
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Hello');
    expect(screen.getByText('Longer text', { selector: 'p' })).toBeTruthy();
    expect(screen.getByText('https://x.test', { selector: 'p' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(simulatorStorageKey('p1'))!)).toEqual({ url: 'https://x.test', title: 'Hello', description: 'Longer text' });
    expect(localStorage.getItem(simulatorStorageKey('p2'))).toBeNull();
  });

  it('restores saved values and falls back per field', () => {
    localStorage.setItem(simulatorStorageKey('p1'), JSON.stringify({ title: 'Saved title' }));
    render(<SerpSimulatorPanel />);
    expect(label('seoTools.serpTitle').value).toBe('Saved title');
    expect(label('seoTools.serpUrl').value).toBe('https://one.test/');
    expect(label('seoTools.serpDescription').value).toBe('');
  });

  it('reloads the form when the project changes and survives corrupt storage', () => {
    localStorage.setItem(simulatorStorageKey('p2'), '{not json');
    localStorage.setItem(simulatorStorageKey('p1'), JSON.stringify({ url: 'https://saved.test', description: 'd1' }));
    render(<SerpSimulatorPanel />);
    expect(label('seoTools.serpUrl').value).toBe('https://saved.test');
    select('p2');
    return screen.findAllByDisplayValue('').then(() => {
      expect(label('seoTools.serpUrl').value).toBe('');
      expect(label('seoTools.serpDescription').value).toBe('');
    });
  });

  it('keeps edits in memory without writing when no project is active', () => {
    select(null);
    render(<SerpSimulatorPanel />);
    fireEvent.change(label('seoTools.serpTitle'), { target: { value: 'Draft' } });
    expect(label('seoTools.serpTitle').value).toBe('Draft');
    expect(localStorage.length).toBe(0);
  });
});
