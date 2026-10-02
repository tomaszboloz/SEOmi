import { vi } from 'vitest';
import { createTopicalNode } from '@/services/topicalMap';
import { createBriefModel } from '@/components/Charts/contentBrief/model';
import type { BriefEditorProps } from '@/components/Charts/contentBrief/types';
import i18n from '@/i18n';

export const briefLabel = (key: string, values?: Record<string, unknown>) => i18n.t(`contentBrief.${key}`, values);
export const briefProps = (overrides: Partial<BriefEditorProps> = {}): BriefEditorProps => ({
  node: createTopicalNode('Coffee'), facts: [], pages: [], onUpdate: vi.fn(), onAdvance: vi.fn(), ...overrides,
});
export const briefModel = (overrides: Partial<BriefEditorProps> = {}) => createBriefModel(briefProps(overrides));
