import { renderHook } from '@testing-library/react';

import { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';

import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';

export type Session = ReturnType<typeof useSiteAuditSession>;

export const tools = useToolsStore.getState();

export const projects = useProjectStore.getState();

export const makeSession = (patch:Partial<Session> = {}): Session => {
  const {result} = renderHook(()=>useSiteAuditSession());
  return {...result.current,...patch};
};

export const text = (key:string) => i18n.t(key);
