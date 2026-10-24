import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { OffPageSourcesWorkspace } from '@/components/Domain/backlinkChecker/OffPageSourcesWorkspace';
import { useOffPageSources } from '@/components/Domain/backlinkChecker/useOffPageSources';
import { sourceProfile } from './fixtures/offPageSources';

vi.mock('@/components/Domain/backlinkChecker/useOffPageSources', () => ({ useOffPageSources: vi.fn() }));
const session = () => ({ status: 'idle' as const, sources: [], analysis: null,
  projectId: null, record: null, historySaved: true,
  settings: { provider: 'ollama' }, setSettings: vi.fn(), run: vi.fn(), cancel: vi.fn(), enabled: true });
beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);
it('supports an unconfigured local Ollama model without inventing an input value', () => {
  vi.mocked(useOffPageSources).mockReturnValue(session());
  render(<OffPageSourcesWorkspace profile={sourceProfile()} />);
  expect((screen.getByLabelText('Ollama embedding model') as HTMLInputElement).value).toBe('');
});
it('exposes Cancel and disables provider edits while an analysis is running', () => {
  const state = { ...session(), status: 'running' as const };
  vi.mocked(useOffPageSources).mockReturnValue(state);
  render(<OffPageSourcesWorkspace profile={sourceProfile()} />);
  expect((screen.getByRole('button', { name: 'Analyze link sources' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText('Local embedding provider') as HTMLSelectElement).disabled).toBe(true);
  expect((screen.getByLabelText('Ollama embedding model') as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(state.cancel).toHaveBeenCalledOnce();
});
