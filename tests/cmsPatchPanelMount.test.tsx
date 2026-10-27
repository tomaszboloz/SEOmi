import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import './fixtures/cmsPanelHarness';
import { GeneralSettingsTab } from '@/components/Settings/settings/GeneralSettingsTab';

vi.mock('@/components/Settings/TeamPanel', () => ({ TeamPanel: () => <section aria-label="Team panel" /> }));
vi.mock('@/components/Settings/DataErasurePanel', () => ({ DataErasurePanel: () => null }));
vi.mock('@/components/Settings/RenderWorkerPanel', () => ({ RenderWorkerPanel: () => null }));
vi.mock('@/components/Settings/MonitoringAlertsPanel', () => ({ MonitoringAlertsPanel: () => null }));

it('mounts the CMS panel immediately after TeamPanel in General settings', () => {
  render(<GeneralSettingsTab auditNotificationsEnabled={false} notificationStatus={null} handleAuditNotificationsChange={vi.fn()} />);
  expect(screen.getByRole('region', { name: 'Team panel' }).nextElementSibling)
    .toBe(screen.getByRole('region', { name: 'Safe CMS patch' }));
});
