import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarProjectCard } from '@/components/Layout/sidebar/SidebarProjectCard';
import i18n from '@/i18n';

describe('active project switcher interaction contracts', () => {
  it('shows an absent project and a project without a root URL honestly', () => {
    const view = render(<SidebarProjectCard sidebarCollapsed={false} />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByRole('button').getAttribute('title')).toBeNull();
    view.rerender(<SidebarProjectCard sidebarCollapsed={false} activeProject={{ id: 'p', name: 'Project' }} />);
    expect(screen.getByText('Project')).toBeTruthy();
    expect(screen.getByRole('button').title).toBe('Project');
    view.rerender(<SidebarProjectCard sidebarCollapsed={false} activeProject={{ id: 'p', name: 'Project', rootUrl: 'https://example.test' }} />);
    expect(screen.getByText('https://example.test')).toBeTruthy();
    expect(screen.getByRole('button').title).toBe('Project · https://example.test');
  });
  it('keeps an accessible name and full tooltip while collapsed', () => {
    render(<SidebarProjectCard sidebarCollapsed activeProject={{ id: 'p', name: 'Project', rootUrl: 'https://example.test' }} />);
    const button = screen.getByRole('button', { name: i18n.t('projects.activeProject') });
    expect(button.title).toBe('Project · https://example.test');
    expect(screen.queryByText('Project')).toBeNull();
    expect(screen.queryByText(i18n.t('projects.changeProject'))).toBeNull();
  });
  it.each(['Enter', ' ', 'Escape'])('opens the real switcher only for activation key %j', (key) => {
    const view = render(<><select id="workspace-project-switcher" aria-label="Select project"><option>Project</option></select>
      <SidebarProjectCard sidebarCollapsed={false} /></>);
    const selector = screen.getByRole('combobox');
    const click = vi.spyOn(selector, 'click');
    fireEvent.keyDown(screen.getByRole('button'), { key });
    expect(click).toHaveBeenCalledTimes(key === 'Escape' ? 0 : 1);
    if (key !== 'Escape') expect(document.activeElement).toBe(selector);
    view.unmount();
  });
  it('focuses and opens the switcher on click', () => {
    render(<><select id="workspace-project-switcher" aria-label="Select project"><option>Project</option></select>
      <SidebarProjectCard sidebarCollapsed={false} /></>);
    const selector = screen.getByRole('combobox');
    const click = vi.spyOn(selector, 'click');
    fireEvent.click(screen.getByRole('button'));
    expect(click).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(selector);
  });
  it('tolerates an unavailable switcher for click and both activation keys', () => {
    render(<SidebarProjectCard sidebarCollapsed={false} />);
    const button = screen.getByRole('button');
    expect(() => fireEvent.click(button)).not.toThrow();
    expect(() => fireEvent.keyDown(button, { key: 'Enter' })).not.toThrow();
    expect(() => fireEvent.keyDown(button, { key: ' ' })).not.toThrow();
    expect(screen.getByText('—')).toBeTruthy();
  });
});
