import { createRef } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateProjectModalHeader } from '@/components/Projects/createProject/CreateProjectModalHeader';
import { ProjectNameInputField } from '@/components/Projects/createProject/ProjectNameInputField';
import { ProjectRootUrlInputField } from '@/components/Projects/createProject/ProjectRootUrlInputField';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';
import i18n from '@/i18n';

describe('CreateProjectModal modular subcomponents and architecture', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('satisfies physical LOC <= 150 across createProject files', () => {
    const files = [
      'src/components/Projects/CreateProjectModal.tsx',
      ...codeFiles('src/components/Projects/createProject'),
    ];
    expect(files.length).toBe(4);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders CreateProjectModalHeader and fires close on X click', () => {
    const onClose = vi.fn();
    render(<CreateProjectModalHeader onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: /Close project dialog|close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders ProjectNameInputField and displays validation error alert when invalid', () => {
    const onChange = vi.fn();
    const nameRef = createRef<HTMLInputElement>();

    const { rerender } = render(
      <ProjectNameInputField
        name="SEO Portal"
        onChange={onChange}
        nameInputRef={nameRef}
        isInvalid={false}
      />,
    );

    const input = screen.getByPlaceholderText(/Main shop/i);
    expect((input as HTMLInputElement).value).toBe('SEO Portal');
    fireEvent.change(input, { target: { value: 'New Name' } });
    expect(onChange).toHaveBeenCalledWith('New Name');
    expect(screen.queryByRole('alert')).toBeNull();

    rerender(
      <ProjectNameInputField
        name=""
        onChange={onChange}
        nameInputRef={nameRef}
        validationError="Project name cannot be empty"
        isInvalid={true}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Project name cannot be empty');
  });

  it('renders ProjectRootUrlInputField and displays root URL error alert when invalid', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <ProjectRootUrlInputField
        rootUrl="https://example.com"
        onChange={onChange}
        isInvalid={false}
      />,
    );

    const input = screen.getByPlaceholderText(/example\.com/i);
    expect((input as HTMLInputElement).value).toBe('https://example.com');
    fireEvent.change(input, { target: { value: 'https://new.example' } });
    expect(onChange).toHaveBeenCalledWith('https://new.example');

    rerender(
      <ProjectRootUrlInputField
        rootUrl="invalid"
        onChange={onChange}
        validationError="Please enter a valid URL"
        isInvalid={true}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('Please enter a valid URL');
  });
});
