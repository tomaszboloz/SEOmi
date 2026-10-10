import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { MonitoringAlertsPanel } from '@/components/Settings/MonitoringAlertsPanel';
import { useProjectStore } from '@/stores/projectStore';

describe('MonitoringAlertsPanel', () => {
  let originalLanguage: string;
  const originalProject = useProjectStore.getState();
  beforeEach(async () => { originalLanguage = i18n.language; await i18n.changeLanguage('en'); localStorage.clear(); useProjectStore.setState({ projects: [], activeProjectId: 'p1' }); });
  afterEach(async () => { useProjectStore.setState(originalProject); await i18n.changeLanguage(originalLanguage); localStorage.clear(); });
  it('renders the project scoped opt-in, frequency, types and thresholds', () => {
    render(<MonitoringAlertsPanel />);
    expect((screen.getByRole('checkbox', { name: 'Enable change monitoring alerts' }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('combobox', { name: 'Monitoring alert frequency' }) as HTMLSelectElement).value).toBe('daily');
    expect((screen.getByRole('spinbutton', { name: 'GSC decline percent' }) as HTMLInputElement).value).toBe('20');
    expect((screen.getByRole('spinbutton', { name: 'PageSpeed category drop' }) as HTMLInputElement).value).toBe('0.1');
  });
  it('persists bounded controls per active project', () => {
    render(<MonitoringAlertsPanel />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Monitoring alert frequency' }), { target: { value: 'weekly' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'GSC decline percent' }), { target: { value: '42' } });
    expect(JSON.parse(localStorage.getItem('seomi_project_p1_monitoring_alert_settings_v1') || '{}')).toMatchObject({ frequency: 'weekly', thresholds: { gsc: { declinePercent: 42 } } });
  });
  it('does not render without an active project', () => { useProjectStore.setState({ activeProjectId: null }); render(<MonitoringAlertsPanel />); expect(screen.queryByRole('checkbox', { name: 'Enable change monitoring alerts' })).toBeNull(); });
});
