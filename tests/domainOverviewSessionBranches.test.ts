import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { FormEvent } from 'react';
import { useDomainOverviewSession } from '@/components/Domain/domainOverview/useDomainOverviewSession';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';

const tools = useToolsStore.getState();
const projects = useProjectStore.getState();
const audit = useAuditStore.getState();
const evt = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent;
const spies = { analyzeDomain: vi.fn(), setDomainQuery: vi.fn(), setBacklinkQuery: vi.fn(), setCrawlUrl: vi.fn(), compareDomains: vi.fn().mockResolvedValue(undefined), setDomainComparisonTargets: vi.fn(), setActiveTab: vi.fn() };
const project = (rootUrl: string) => ({ id: 'p1', name: 'P', rootUrl }) as never;
beforeEach(() => {
  Object.values(spies).forEach((s) => s.mockClear());
  useProjectStore.setState({ projects: [project('')], activeProjectId: 'p1' });
  useToolsStore.setState({ domainQuery: '', domainOverview: null, domainComparisonTargets: [], ...spies } as never);
  useAuditStore.setState({ setActiveTab: spies.setActiveTab } as never);
});
afterEach(() => { useToolsStore.setState(tools); useProjectStore.setState(projects); useAuditStore.setState(audit); });

it('ignores blank analyze input but analyzes the trimmed domain', () => {
  const { result } = renderHook(() => useDomainOverviewSession());
  const blank = evt();
  act(() => result.current.handleAnalyze(blank));
  expect(blank.preventDefault).toHaveBeenCalled();
  expect(spies.analyzeDomain).not.toHaveBeenCalled();
  
  act(() => result.current.setInputDomain('  example.com '));
  act(() => result.current.handleAnalyze(evt()));
  expect(spies.setDomainQuery).toHaveBeenCalledWith('example.com');
  expect(spies.analyzeDomain).toHaveBeenCalledWith('example.com', useToolsStore.getState().domainCountry, useToolsStore.getState().domainLanguage);
});

it('prefills the project root url once when no domain query exists', () => {
  useProjectStore.setState({ projects: [project(' https://root.test ')] });
  const { result, rerender } = renderHook(() => useDomainOverviewSession());
  expect(spies.setDomainQuery).toHaveBeenCalledWith('https://root.test');
  expect(result.current.inputDomain).toBe('https://root.test');
  rerender();
  expect(spies.setDomainQuery).toHaveBeenCalledTimes(1);
});

it('does not prefill when a query already exists or the project has no root', () => {
  useToolsStore.setState({ domainQuery: 'kept.test' });
  useProjectStore.setState({ projects: [project('https://root.test')] });
  const { result } = renderHook(() => useDomainOverviewSession());
  expect(spies.setDomainQuery).not.toHaveBeenCalled();
  expect(result.current.inputDomain).toBe('kept.test');
  act(() => useProjectStore.setState({ activeProjectId: null }));
  expect(spies.setDomainQuery).not.toHaveBeenCalled();
});

it('navigates using the overview domain, falling back to the input', () => {
  const { result, rerender } = renderHook(() => useDomainOverviewSession());
  act(() => result.current.setInputDomain('typed.test'));
  act(() => result.current.handleNavigateBacklinks());
  act(() => result.current.handleNavigateSiteAudit());
  expect(spies.setBacklinkQuery).toHaveBeenCalledWith('typed.test');
  expect(spies.setCrawlUrl).toHaveBeenCalledWith('https://typed.test');
  act(() => useToolsStore.setState({ domainOverview: { domain: 'real.test' } as never }));
  rerender();
  act(() => result.current.handleNavigateBacklinks());
  act(() => result.current.handleNavigateSiteAudit());
  expect(spies.setBacklinkQuery).toHaveBeenLastCalledWith('real.test');
  expect(spies.setCrawlUrl).toHaveBeenLastCalledWith('https://real.test');
  expect(spies.setActiveTab).toHaveBeenCalledWith('backlink-checker');
  expect(spies.setActiveTab).toHaveBeenCalledWith('site-audit');
});

it('compares the target with split, trimmed competitors and hides the target from the input', () => {
  useToolsStore.setState({ domainOverview: { domain: 'me.test' } as never, domainComparisonTargets: ['me.test', 'a.test', 'b.test'] });
  const { result } = renderHook(() => useDomainOverviewSession());
  expect(result.current.comparisonInput).toBe('a.test\nb.test');
  act(() => result.current.setComparisonInput('x.test, y.test;\n\n z.test ,'));
  const e = evt();
  act(() => result.current.handleCompareDomains(e));
  expect(e.preventDefault).toHaveBeenCalled();
  const expected = ['me.test', 'x.test', 'y.test', 'z.test'];
  expect(spies.setDomainComparisonTargets).toHaveBeenCalledWith(expected);
  expect(spies.compareDomains).toHaveBeenCalledWith(expected);
});

it('compares against the typed domain when no overview is loaded', () => {
  const { result } = renderHook(() => useDomainOverviewSession());
  act(() => result.current.setInputDomain('typed.test'));
  act(() => result.current.setComparisonInput(''));
  act(() => result.current.handleCompareDomains(evt()));
  expect(spies.compareDomains).toHaveBeenCalledWith(['typed.test']);
});
