import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { readDataForSeoTarget } from '@/stores/audit/auditStorage';
import { invokeTauriCommand } from '@/services/tauri';
import { readImportedSerp } from '@/components/Keywords/embeddingClustering/importedSerpStorage';
import { buildTargetPhraseAudit } from '@/services/targetPhraseAudit/evidence';
import { buildTopTenContentGap, collectTopTenContentGap } from '@/services/targetPhraseAudit/contentGap';
import type { PageAuditData } from '@/types';
import type { SerpSnapshot, SerpSource } from '@/services/serpImport';
import { type TargetPhraseAudit, type TopTenContentGapReport, type TopTenSerpRow } from '@/services/targetPhraseAudit';

export const normalizeTargetPhrase = (value: string): string => value.trim().replace(/\s+/gu, ' ');

export interface TargetPhraseAuditSession {
  activeProjectId: string | null;
  phrase: string;
  setPhrase: (value: string) => void;
  evidence: TargetPhraseAudit | null;
  source: SerpSource | null;
  snapshot: SerpSnapshot | null;
  report: TopTenContentGapReport | null;
  isLoading: boolean;
  error: string | null;
  unavailableReason: 'no-project' | 'no-phrase' | 'no-import' | 'phrase-not-found' | 'no-results' | null;
  canAudit: boolean;
  auditTopTen: () => Promise<void>;
}

const sourceKey = (source: SerpSource | null): string => source
  ? [source.provider, source.countryCode, source.locationCode, source.languageCode, source.retrievedAt].join('|')
  : '';

export const useTargetPhraseAuditSession = (audit: PageAuditData): TargetPhraseAuditSession => {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const [phrase, setPhrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspected, setInspected] = useState<{ key: string; report: TopTenContentGapReport } | null>(null);
  const operationRef = useRef(0);
  const mountedRef = useRef(true);
  const normalizedPhrase = normalizeTargetPhrase(phrase);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; operationRef.current += 1; };
  }, []);

  useEffect(() => {
    operationRef.current += 1;
    const nextPhrase = activeProjectId ? readDataForSeoTarget(activeProjectId) || '' : '';
    setPhrase((current) => current === nextPhrase ? current : nextPhrase);
    setInspected((current) => current === null ? current : null);
    setIsLoading((current) => current ? false : current);
    setError((current) => current === null ? current : null);
  }, [activeProjectId]);

  const imported = useMemo(() => readImportedSerp(activeProjectId), [activeProjectId]);
  const snapshot = useMemo(() => {
    if (!imported || !normalizedPhrase) return null;
    const wanted = normalizedPhrase.toLocaleLowerCase();
    return imported.result.snapshots.find((item) => normalizeTargetPhrase(item.keyword).toLocaleLowerCase() === wanted) || null;
  }, [imported, normalizedPhrase]);
  const source = snapshot && imported ? imported.result.source : null;
  const rows = useMemo<TopTenSerpRow[]>(() => snapshot
    ? snapshot.rows.map((row) => ({ type: 'organic', rank: row.rank, rank_absolute: row.rank, url: row.url }))
    : [], [snapshot]);
  const requestIndexByUrl = useMemo(() => new Map(rows.map((row, index) => [String(row.url), index])), [rows]);
  const evidence = useMemo(() => normalizedPhrase ? buildTargetPhraseAudit(audit, normalizedPhrase) : null, [audit, normalizedPhrase]);
  const targetEvidence = useMemo(() => ({ url: audit.final_url || audit.url, fetchedAt: audit.timestamp || null, audit }), [audit]);
  const reportKey = [activeProjectId, normalizedPhrase, imported?.importedAt, snapshot?.keyword, audit.final_url, audit.timestamp, sourceKey(source)].join('|');
  const baseReport = useMemo(() => snapshot && imported
    ? buildTopTenContentGap({
      phrase: normalizedPhrase, rows, evidence: [], targetEvidence,
      locationCode: source?.locationCode, languageCode: source?.languageCode,
      retrievedAt: source?.retrievedAt || source?.capturedAt || imported.importedAt,
    })
    : null, [audit, imported, normalizedPhrase, rows, snapshot, source, targetEvidence]);

  useEffect(() => {
    operationRef.current += 1;
    setInspected((current) => current === null ? current : null);
    setIsLoading((current) => current ? false : current);
    setError((current) => current === null ? current : null);
  }, [reportKey]);

  const unavailableReason = !activeProjectId ? 'no-project'
    : !normalizedPhrase ? 'no-phrase'
      : !imported ? 'no-import'
        : !snapshot ? 'phrase-not-found'
          : !snapshot.rows.length ? 'no-results' : null;
  const canAudit = Boolean(snapshot?.rows.length && evidence && targetEvidence.url);
  const report = inspected?.key === reportKey ? inspected.report : baseReport;

  const auditTopTen = useCallback(async () => {
    const projectId = activeProjectId;
    if (!projectId || !snapshot || !rows.length || !evidence) return;
    const operation = ++operationRef.current;
    const current = () => mountedRef.current
      && operationRef.current === operation
      && useProjectStore.getState().activeProjectId === projectId;
    setIsLoading(true);
    setError(null);
    try {
      const next = await collectTopTenContentGap({
        phrase: normalizedPhrase,
        rows,
        targetEvidence,
        locationCode: source?.locationCode,
        languageCode: source?.languageCode,
        retrievedAt: source?.retrievedAt || source?.capturedAt || imported?.importedAt,
        inspectUrl: (url) => invokeTauriCommand<PageAuditData>('inspect_url', {
          url,
          requestId: `target-phrase-${projectId}-${operation}-${requestIndexByUrl.get(url)!}`,
        }),
      });
      if (current()) setInspected({ key: reportKey, report: next });
    } catch (caught) {
      if (current()) setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (current()) setIsLoading(false);
    }
  }, [activeProjectId, evidence, imported, normalizedPhrase, reportKey, requestIndexByUrl, rows, snapshot, source, targetEvidence]);

  return { activeProjectId, phrase, setPhrase, evidence, source, snapshot, report, isLoading, error, unavailableReason, canAudit, auditTopTen };
};
