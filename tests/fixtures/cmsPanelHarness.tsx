import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import i18n from '@/i18n';
import { CmsPatchPanel } from '@/components/Settings/CmsPatchPanel';
import { useProjectStore } from '@/stores/projectStore';
import { flushAuditWrites } from '@/services/team/auditStore';
import type { CmsKind } from '@/services/cmsPatch/types';
import { mockCms } from './cmsMock';

const { transport, backup } = vi.hoisted(() => ({ transport: vi.fn(), backup: vi.fn() }));
vi.mock('@/services/cmsPatch/transport', () => ({ cmsTransport: transport }));
vi.mock('@/services/dataErasure', () => ({ putSubjectRecord: backup }));

beforeEach(async () => {
  await flushAuditWrites();
  localStorage.clear();
  await i18n.changeLanguage('en');
  transport.mockReset();
  backup.mockReset().mockResolvedValue(undefined);
  useProjectStore.setState({ activeProjectId: 'cms-project' });
});
afterEach(async () => { cleanup(); await flushAuditWrites(); });

export const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
export const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
export const approve = () => fireEvent.click(screen.getByLabelText('I approve this exact diff'));
export const fill = (kind: CmsKind = 'wordpress') => {
  change('CMS kind', kind);
  change('CMS base URL (HTTPS)', 'https://cms.example.com');
  change('Content ID', '7');
  change('Heading to find', 'Pricing');
  change('New section content (HTML or Markdown)', '<p>new</p>');
};
export const setup = (kind: CmsKind = 'wordpress', initial?: string) => {
  const cms = mockCms(kind, initial);
  transport.mockImplementation(cms.send);
  render(<CmsPatchPanel />);
  fill(kind);
  return cms;
};
export const prepare = async () => {
  fireEvent.click(button('Prepare diff'));
  return screen.findByRole('region', { name: 'Proposed diff' });
};
export const dryRun = async () => {
  fireEvent.click(button('Run dry run'));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Dry run: nothing was written.'));
};
export const renderPanel = () => render(<CmsPatchPanel />);
export { transport, backup };
