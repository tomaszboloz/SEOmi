import { beforeEach, describe, expect, it } from 'vitest';
import { auditUrlDraftKey } from '@/components/URLBar/urlInput/urlInputTypes';
import { activeProjectForTaskLog } from '@/services/dataforseo/dataforseoTaskLog';
import { normalizeTargetPhrase } from '@/components/Results/targetPhraseAudit/useTargetPhraseAuditSession';

beforeEach(() => {
  localStorage.clear();
});

describe('miscellaneous public pure functions direct assertions', () => {
  it('auditUrlDraftKey generates a versioned storage key for project URL drafts', () => {
    expect(auditUrlDraftKey('proj-42')).toBe('seomi_project_proj-42_audit_url_draft_v1');
    expect(auditUrlDraftKey('alpha')).toBe('seomi_project_alpha_audit_url_draft_v1');
  });

  it('activeProjectForTaskLog retrieves and validates active project ID from storage', () => {
    expect(activeProjectForTaskLog()).toBeNull();

    localStorage.setItem('seomi_active_project_v1', 'valid-project-id');
    expect(activeProjectForTaskLog()).toBe('valid-project-id');

    localStorage.setItem('seomi_active_project_v1', 'invalid/character');
    expect(activeProjectForTaskLog()).toBeNull();

    localStorage.setItem('seomi_active_project_v1', 'a'.repeat(81));
    expect(activeProjectForTaskLog()).toBeNull();
  });

  it('normalizeTargetPhrase trims leading/trailing whitespace and collapses repeated internal spaces', () => {
    expect(normalizeTargetPhrase('  seo   audit   tool  ')).toBe('seo audit tool');
    expect(normalizeTargetPhrase('simple phrase')).toBe('simple phrase');
    expect(normalizeTargetPhrase('   ')).toBe('');
  });
});
