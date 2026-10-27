import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeploymentArtifactsPanel } from '@/components/Charts/DeploymentArtifactsPanel';
import * as download from '@/services/download';
import i18n from '@/i18n';

describe('DeploymentArtifactsPanel', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows empty state without rules', () => {
    render(<DeploymentArtifactsPanel rules={[]} />);
    expect(screen.getByText(i18n.t('executionCard.deploy.empty'))).toBeTruthy();
  });

  it('downloads each format and the zip, lists issues', () => {
    const spy = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);
    render(<DeploymentArtifactsPanel rules={[{ from: 'https://a.test/a', to: 'https://a.test/b', status: 301 }, { from: 'https://a.test/g', to: null, status: 410 }]} />);
    screen.getAllByRole('button').filter((b) => !b.hasAttribute('data-help-id')).forEach((b) => fireEvent.click(b));
    expect(spy.mock.calls.map((c) => c[0])).toContain('seomi-redirects.zip');
    expect(spy).toHaveBeenCalledTimes(6);
    expect(within(screen.getByRole('list', { name: i18n.t('executionCard.deploy.issuesAria') })).getAllByRole('listitem')).toHaveLength(1);
  });
});
