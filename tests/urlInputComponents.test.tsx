import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { URLInput } from '@/components/URLBar/URLInput';
import { URLInputField } from '@/components/URLBar/urlInput/URLInputField';
import { URLInputActions } from '@/components/URLBar/urlInput/URLInputActions';
import { URLBatchQueueSection } from '@/components/URLBar/urlInput/URLBatchQueueSection';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';
import i18n from '@/i18n';

describe('URLInput modular components and architecture', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('en');
    useProjectStore.setState({ projects: [], activeProjectId: null });
    useAuditStore.setState({
      batchItems: [],
      batchRun: null,
      batchWakeupError: null,
      isBatchRunning: false,
      isBatchStopping: false,
      isLoading: false,
      currentAudit: null,
    });
  });

  it('satisfies physical LOC <= 150 across URLInput and urlInput submodules', () => {
    const files = [
      'src/components/URLBar/URLInput.tsx',
      ...codeFiles('src/components/URLBar/urlInput'),
    ];
    expect(files.length).toBe(5);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders the complete URLInput facade', () => {
    render(<URLInput />);
    expect(screen.getByRole('textbox')).toBeDefined();
    expect(screen.getByRole('button', { name: /Audit URL/i })).toBeDefined();
  });

  it('renders URLInputField and handles input change and paste call', () => {
    const onChange = vi.fn();
    const onPaste = vi.fn();

    render(
      <URLInputField
        url="https://example.com"
        onChange={onChange}
        onPaste={onPaste}
        isLoading={false}
      />,
    );

    const input = screen.getByRole('textbox');
    expect((input as HTMLInputElement).value).toBe('https://example.com');
    fireEvent.change(input, { target: { value: 'https://example.com/test' } });
    expect(onChange).toHaveBeenCalledWith('https://example.com/test');

    const pasteBtn = screen.getByTitle('Paste');
    fireEvent.click(pasteBtn);
    expect(onPaste).toHaveBeenCalledTimes(1);
  });

  it('renders URLInputActions submit and re-audit buttons', () => {
    const onReAudit = vi.fn();

    const { rerender } = render(
      <URLInputActions
        url="https://example.com"
        isLoading={false}
        onReAudit={onReAudit}
        hasCurrentAudit={false}
      />,
    );

    const analyzeBtn = screen.getByRole('button', { name: /Audit URL/i });
    expect(analyzeBtn).toBeDefined();
    expect(screen.queryByTitle(/Re-run audit/i)).toBeNull();

    rerender(
      <URLInputActions
        url="https://example.com"
        isLoading={false}
        onReAudit={onReAudit}
        hasCurrentAudit={true}
      />,
    );

    const reauditBtn = screen.getByTitle(/Re-run audit/i);
    fireEvent.click(reauditBtn);
    expect(onReAudit).toHaveBeenCalledTimes(1);
  });

  it('renders URLBatchQueueSection with running and stop controls', () => {
    useAuditStore.setState({
      batchItems: [
        { id: '1', url: 'https://a.com', status: 'completed' },
        { id: '2', url: 'https://b.com', status: 'running' },
      ],
      isBatchRunning: true,
      batchRun: { status: 'running', updatedAt: new Date().toISOString() } as any,
    });

    render(<URLBatchQueueSection />);
    expect(screen.getByText(/Stop/i)).toBeDefined();
    expect(screen.getByTitle(/Clear/i)).toBeDefined();
  });
});
