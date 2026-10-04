import { expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCrawlOperationScope } from '@/components/Domain/siteAudit/session/useCrawlOperationScope';

it('keeps independent operation types current and invalidates only superseded instances', () => {
  const hook = renderHook(() => useCrawlOperationScope('project'));
  const oldPdf = hook.result.current('pdf');
  const comparison = hook.result.current('comparison');
  expect(oldPdf()).toBe(true);
  expect(comparison()).toBe(true);
  const newPdf = hook.result.current('pdf');
  expect(oldPdf()).toBe(false);
  expect(comparison()).toBe(true);
  expect(newPdf()).toBe(true);
  hook.unmount();
  expect(comparison()).toBe(false);
  expect(newPdf()).toBe(false);
});

it('invalidates project generations including return to the same project and projectless transitions', () => {
  const hook = renderHook(({ project }) => useCrawlOperationScope(project), { initialProps: { project: 'one' as string | null } });
  const first = hook.result.current('start');
  hook.rerender({ project: 'two' });
  expect(first()).toBe(false);
  const second = hook.result.current('start');
  hook.rerender({ project: 'one' });
  expect(first()).toBe(false);
  expect(second()).toBe(false);
  const third = hook.result.current('start');
  hook.rerender({ project: null });
  expect(third()).toBe(false);
  const projectless = hook.result.current('start');
  expect(projectless()).toBe(true);
  hook.unmount();
  expect(projectless()).toBe(false);
});
