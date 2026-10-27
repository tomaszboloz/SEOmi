import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPaletteHeader } from '@/components/Layout/commandPalette/CommandPaletteHeader';
import { CommandPaletteList } from '@/components/Layout/commandPalette/CommandPaletteList';
import { CommandPaletteFooter } from '@/components/Layout/commandPalette/CommandPaletteFooter';
import { CommandPalette } from '@/components/Layout/CommandPalette';
import { useUIStore } from '@/stores/uiStore';
import type { PaletteItem } from '@/components/Layout/commandPalette/commandPaletteTypes';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string) => key) as any;

describe('CommandPalette modular architecture', () => {
  it('satisfies physical LOC <= 150 across commandPalette files', () => {
    const files = [
      'src/components/Layout/CommandPalette.tsx',
      ...codeFiles('src/components/Layout/commandPalette'),
    ];
    expect(files.length).toBe(7);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders CommandPaletteHeader and responds to input changes and close', () => {
    const inputRef = { current: null };
    const onQueryChange = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPaletteHeader
        inputRef={inputRef}
        query="test"
        onQueryChange={onQueryChange}
        onClose={onClose}
        t={mockT}
      />,
    );

    const input = screen.getByLabelText('commandPalette.searchLabel');
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: 'audit' } });
    expect(onQueryChange).toHaveBeenCalledWith('audit');

    const closeBtn = screen.getByLabelText('commandPalette.close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders CommandPaletteList with options and triggers action', () => {
    const actionSpy = vi.fn();
    const items: PaletteItem[] = [
      {
        id: 'item-1',
        label: 'Dashboard',
        group: 'Navigation',
        keywords: 'home overview',
        icon: () => <span data-testid="icon" />,
        action: actionSpy,
      },
    ];

    const activeOptionRef = { current: null };
    const onSelectIndex = vi.fn();

    render(
      <CommandPaletteList
        filteredItems={items}
        activeIndex={0}
        activeOptionRef={activeOptionRef}
        activeProjectId="p1"
        onSelectIndex={onSelectIndex}
        t={mockT}
      />,
    );

    const option = screen.getByRole('option');
    expect(option).toBeTruthy();
    fireEvent.mouseEnter(option);
    expect(onSelectIndex).toHaveBeenCalledWith(0);
    fireEvent.click(option);
    expect(actionSpy).toHaveBeenCalled();
  });

  it('renders CommandPaletteList empty state and active project badge', () => {
    const activeItem: PaletteItem = {
      id: 'project:p1',
      label: 'Active Proj',
      group: 'Projects',
      keywords: 'p1',
      icon: () => <span />,
      action: vi.fn(),
    };
    const { rerender } = render(
      <CommandPaletteList
        filteredItems={[activeItem]}
        activeIndex={0}
        activeOptionRef={{ current: null }}
        activeProjectId="p1"
        onSelectIndex={vi.fn()}
        t={mockT}
      />,
    );
    expect(screen.getByText('commandPalette.active')).toBeTruthy();

    rerender(
      <CommandPaletteList
        filteredItems={[]}
        activeIndex={-1}
        activeOptionRef={{ current: null }}
        activeProjectId="p1"
        onSelectIndex={vi.fn()}
        t={mockT}
      />,
    );
    expect(screen.getByText('commandPalette.noResults')).toBeTruthy();
  });

  it('renders CommandPaletteFooter with keyboard shortcut and items count', () => {
    render(<CommandPaletteFooter count={12} t={mockT} />);
    expect(screen.getByText('commandPalette.keyboardHelp')).toBeTruthy();
    expect(screen.getByText('commandPalette.itemsCount')).toBeTruthy();
  });

  it('renders CommandPalette and closes on backdrop click', () => {
    useUIStore.setState({ commandPaletteOpen: true });
    render(<CommandPalette />);
    const backdrop = screen.getByRole('presentation');
    fireEvent.mouseDown(backdrop);
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });
});
