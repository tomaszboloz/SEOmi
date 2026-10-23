import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { OutreachTargetsPanel } from '@/components/Domain/OutreachTargetsPanel';

const target = { domain: 'blog.com', linkingCompetitors: ['a.com', 'b.com'], relevance: 0.66, authority: 0.7, priority: 0.462 };

describe('OutreachTargetsPanel', () => {
  it('shows an empty state without export', () => {
    render(<OutreachTargetsPanel targets={[]} onExport={vi.fn()} />);
    expect(screen.getByTestId('outreach-panel').textContent).toContain('No backlink gap data');
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });

  it('lists targets and exports on demand', () => {
    const onExport = vi.fn();
    render(<OutreachTargetsPanel targets={[target]} onExport={onExport} />);
    expect(screen.getByText('blog.com: priority 0.46, links to 2 competitors')).toBeTruthy();
    expect(screen.getByText(/never sends messages/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(onExport).toHaveBeenCalledWith([target]);
  });
});
