import type { BacklinkGapReport } from '@/types';
import { csv, exportHeaders, exportText } from './csv';
import { downloadText } from './download';

export const backlinkGapCsv = (report: BacklinkGapReport): string => {
  const competitors = report.competitors;
  const backlinkHeaders = exportHeaders('backlink');
  const headers = [backlinkHeaders[0], backlinkHeaders[1], ...competitors.flatMap((domain) => [`${domain} backlinks`, `${domain} rank`]), backlinkHeaders[2]];
  const rows = report.opportunities.map((opportunity) => {
    const byDomain = new Map(opportunity.competitor_backlinks.map((item) => [item.domain, item]));
    return [report.target, opportunity.referring_domain, ...competitors.flatMap((domain) => {
      const item = byDomain.get(domain);
      return [item?.backlinks ?? '', item?.rank ?? ''];
    }), opportunity.max_competitor_spam_score ?? ''];
  });
  return csv([[backlinkHeaders[0], report.target], [exportText('labels.competitors'), competitors.join('; ')], [exportText('labels.includeSubdomains'), report.include_subdomains], [exportText('labels.apiRowsScanned'), report.rows_scanned], [], headers, ...rows]);
};

export const downloadBacklinkGapCsv = (report: BacklinkGapReport): void => {
  const host = report.target.replace(/[^a-z0-9.-]/gi, '-');
  const date = new Date().toISOString().slice(0, 10);
  downloadText(`seomi-backlink-gap-${host}-${date}.csv`, backlinkGapCsv(report), 'text/csv');
};

