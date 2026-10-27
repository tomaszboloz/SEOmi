import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { MonitoringAlertsPanel } from '@/components/Settings/MonitoringAlertsPanel';
import { useProjectStore } from '@/stores/projectStore';

describe('MonitoringAlertsPanel', () => {
  let originalLanguage: string;
  const originalProject = useProjectStore.getState();
  beforeEach(async () => { originalLanguage = i18n.language; await i18n.changeLanguage('en'); localStorage.clear(); act(() => useProjectStore.setState({ projects: [], activeProjectId: 'p1' })); });
  afterEach(async () => { cleanup(); await act(async () => { useProjectStore.setState(originalProject); await i18n.changeLanguage(originalLanguage); }); localStorage.clear(); });
  it('renders the project scoped opt-in, frequency, types and thresholds', async () => {
    await act(async () => { render(<MonitoringAlertsPanel />); });
    expect((screen.getByRole('checkbox', { name: 'Enable change monitoring alerts' }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('combobox', { name: 'Monitoring alert frequency' }) as HTMLSelectElement).value).toBe('daily');
    expect((screen.getByRole('spinbutton', { name: 'GSC decline percent' }) as HTMLInputElement).value).toBe('20');
    expect((screen.getByRole('spinbutton', { name: 'PageSpeed category drop' }) as HTMLInputElement).value).toBe('0.1');
    expect((screen.getByRole('spinbutton', { name: 'Site Focus Score drop (points)' }) as HTMLInputElement).value).toBe('5');
    expect((screen.getByRole('spinbutton', { name: 'AIO-R score drop (points)' }) as HTMLInputElement).value).toBe('10');
    expect((screen.getByRole('checkbox', { name: 'Enable AI Overviews readiness alerts' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Site Focus Score drop (points)' }), { target: { value: '8' } });
    expect(JSON.parse(localStorage.getItem('seomi_project_p1_monitoring_alert_settings_v1') || '{}')).toMatchObject({ thresholds: { focus: { dropPoints: 8 } } });
  });
  it('persists bounded controls per active project', async () => {
    await act(async () => { render(<MonitoringAlertsPanel />); });
    fireEvent.change(screen.getByRole('combobox', { name: 'Monitoring alert frequency' }), { target: { value: 'weekly' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'GSC decline percent' }), { target: { value: '42' } });
    expect(JSON.parse(localStorage.getItem('seomi_project_p1_monitoring_alert_settings_v1') || '{}')).toMatchObject({ frequency: 'weekly', thresholds: { gsc: { declinePercent: 42 } } });
  });
  it('persists every threshold input', async () => {
    await act(async () => { render(<MonitoringAlertsPanel />); });
    for (const [name, value] of [['GSC minimum impressions', '300'], ['PageSpeed category drop', '0.2'], ['Crawl changed pages', '7'], ['Semantic changes', '9'], ['Site Focus Score drop (points)', '6'], ['AIO-R score drop (points)', '12']]) {
      fireEvent.change(screen.getByRole('spinbutton', { name }), { target: { value } });
    }
    screen.getAllByRole('checkbox').forEach((box) => fireEvent.click(box));
    const saved = JSON.parse(localStorage.getItem('seomi_project_p1_monitoring_alert_settings_v1') || '{}');
    expect(saved.thresholds).toMatchObject({ gsc: { minImpressions: 300 }, pagespeed: { categoryDrop: 0.2 }, crawl: { changedPages: 7 }, semantic: { changes: 9 }, focus: { dropPoints: 6 }, aio: { dropPoints: 12 } });
    expect(saved.types.aio).toBe(false);
  });

  it('migrates missing AIO controls and isolates changes when switching projects', async () => {
    localStorage.setItem('seomi_project_p1_monitoring_alert_settings_v1', JSON.stringify({ types: { focus: false }, thresholds: { focus: { dropPoints: 23 } } }));
    await act(async () => { render(<MonitoringAlertsPanel />); });
    expect((screen.getByRole('spinbutton', { name: 'AIO-R score drop (points)' }) as HTMLInputElement).value).toBe('10');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'AIO-R score drop (points)' }), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable AI Overviews readiness alerts' }));
    const saved = localStorage.getItem('seomi_project_p1_monitoring_alert_settings_v1');
    expect(JSON.parse(saved!)).toMatchObject({ types: { focus: false, aio: false }, thresholds: { focus: { dropPoints: 23 }, aio: { dropPoints: 18 } } });
    act(() => useProjectStore.setState({ activeProjectId: 'p2' }));
    expect((screen.getByRole('spinbutton', { name: 'AIO-R score drop (points)' }) as HTMLInputElement).value).toBe('10');
    expect((screen.getByRole('checkbox', { name: 'Enable AI Overviews readiness alerts' }) as HTMLInputElement).checked).toBe(true);
    expect(localStorage.getItem('seomi_project_p1_monitoring_alert_settings_v1')).toBe(saved);
  });

  it('does not render without an active project', async () => { act(() => useProjectStore.setState({ activeProjectId: null })); await act(async () => { render(<MonitoringAlertsPanel />); }); expect(screen.queryByRole('checkbox', { name: 'Enable change monitoring alerts' })).toBeNull(); });
});
