import i18n from '@/i18n';
import { CmsError, type CmsKind } from '@/services/cmsPatch/types';
import type { Backup } from '@/services/cmsPatch/apply';
import { putSubjectRecord } from '@/services/dataErasure';

export interface CmsPanelFields {
  kind: CmsKind;
  baseUrl: string;
  contentId: string;
  credential: string;
  collection: string;
  heading: string;
  replacement: string;
  ymyl: boolean;
}

export const initialCmsFields: CmsPanelFields = {
  kind: 'wordpress', baseUrl: '', contentId: '', credential: '', collection: 'articles',
  heading: '', replacement: '', ymyl: false,
};

export const cmsPanelError = (error: unknown): string => {
  if (error instanceof CmsError) return i18n.t(`cmsUi.error.${error.code}`);
  if (error instanceof Error && error.message === 'cmsPanelUi.desktopOnly') return i18n.t(error.message);
  return i18n.t('cmsPanelUi.failed', { reason: error instanceof Error ? error.message : String(error) });
};

export const saveCmsBackup = async (projectId: string, backup: Backup): Promise<void> => {
  await putSubjectRecord(projectId, 'cms-patch-backup', `${backup.target.kind}:${backup.target.contentId}:${backup.revision}`,
    'cms-patch-backup', Array.from(new TextEncoder().encode(JSON.stringify(backup))));
};
