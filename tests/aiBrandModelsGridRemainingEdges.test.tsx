import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import i18n from '@/i18n';
import type { BrandAiVisibilityReport } from '@/types';
import { AiBrandModelsGrid } from '@/components/AiVisibility/brandVisibility/AiBrandModelsGrid';

const report = (patch: Partial<BrandAiVisibilityReport> = {}): BrandAiVisibilityReport => ({
  brand: 'SEOmi', domain: 'seomi.test', overall_score: null, models: [], query_checked: 'query',
  timestamp: '2026-10-01T10:00:00Z', key_takeaways: [], ...patch,
});
afterEach(cleanup);

describe('AI brand model grid history branches', () => {
  it('renders history with and without domains and handles selection', () => {
    const first = report({ timestamp: '2026-10-01T10:00:00Z', domain: '' });
    const second = report({ timestamp: '2026-10-02T10:00:00Z', domain: 'seomi.test' });
    const onSelectReport = vi.fn();
    render(<AiBrandModelsGrid report={first} history={[first, second]} onSelectReport={onSelectReport} t={i18n.t} />);

    expect(screen.getByText(i18n.t('aiVisibility.brand.noClients'))).toBeTruthy();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: second.timestamp } });
    expect(onSelectReport).toHaveBeenCalledWith(second.timestamp);
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});
