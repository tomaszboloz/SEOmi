import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import type { PageAuditData } from '@/types';
import { useAuditStore } from '@/stores/auditStore';
import { downloadAuditLinksCsv } from '@/services/export';
import { LinkMetrics } from './links/LinkMetrics';
import { LinkControls } from './links/LinkControls';
import { LinkCard } from './links/LinkCard';
import { LinkPagination } from './links/LinkPagination';
import { useLinkVerification } from './links/useLinkVerification';
import { filterAuditLinks, insecureLink, unsafeBlankLink, type LinkFilter } from './links/linkPolicy';

export const LinksAudit = ({audit}:{audit:PageAuditData}) => {
 const {t}=useTranslation();
 const [filterType,setFilterType]=useState<LinkFilter>('all');
 const [search,setSearch]=useState('');
 const [currentPage,setCurrentPage]=useState(1);
 const problems=useAuditStore(state=>state.showOnlyProblems);
 const verification=useLinkVerification();
 const {links,url}=audit; const isPageHttps=url.toLowerCase().startsWith('https://');
 const securityIssuesCount=links.links.filter(unsafeBlankLink).length+links.links.filter(link=>insecureLink(link,isPageHttps)).length;
 const filtered=filterAuditLinks(links.links,filterType,search,problems,isPageHttps,verification.verifiedLinks);
 const totalPages=Math.max(1,Math.ceil(filtered.length/50));
 const currentSafePage=Math.min(currentPage,totalPages); const startIndex=(currentSafePage-1)*50;
 const paginatedLinks=filtered.slice(startIndex,startIndex+50);
 return <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-200">
   <LinkMetrics links={links} securityIssuesCount={securityIssuesCount} />
   <LinkControls links={links} securityIssuesCount={securityIssuesCount} search={search} setSearch={setSearch} setCurrentPage={setCurrentPage} filterType={filterType} setFilterType={setFilterType} isVerifyingBatch={verification.isVerifyingBatch} pageCount={paginatedLinks.length} handleVerifyBatch={()=>verification.handleVerifyBatch(paginatedLinks)} exportCsv={()=>downloadAuditLinksCsv(audit)} />
   <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden"><div className="divide-y divide-slate-800/80">
     {paginatedLinks.length ? paginatedLinks.map((link,index)=><LinkCard key={index} link={link} pageUrl={audit.final_url || audit.url} isPageHttps={isPageHttps} verified={verification.verifiedLinks[link.href]} copiedUrl={verification.copiedUrl} handleCopy={verification.handleCopy} handleVerifySingleLink={verification.handleVerifySingleLink} />) : <div className="p-12 text-center text-slate-400 text-xs"><ExternalLink className="w-8 h-8 mx-auto mb-2 text-slate-600" />{t('legacyUi.links.empty')}</div>}
   </div>{totalPages>1 && <LinkPagination startIndex={startIndex} totalCount={filtered.length} currentSafePage={currentSafePage} totalPages={totalPages} setCurrentPage={setCurrentPage} />}</div>
 </div>;
};
