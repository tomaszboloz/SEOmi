import React from 'react';
import type { useCrawlResultsSession } from './useCrawlResultsSession';
import { computeCrawlLinksData } from './linksTab/crawlLinksTabHelpers';
import { CrawlLinksFilters } from './linksTab/CrawlLinksFilters';
import { CrawlLinksInternalSummary } from './linksTab/CrawlLinksInternalSummary';
import { CrawlLinksExternalCheck } from './linksTab/CrawlLinksExternalCheck';
import { CrawlLinksTable } from './linksTab/CrawlLinksTable';

type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlLinksTab: React.FC<{ session: Session }> = ({ session }) => {
  const {
    checkExternalLinks,
    copiedLinkSourceKey,
    copyLinkSource,
    currentRun,
    externalLinkCheckError,
    externalLinkCheckProgress,
    externalLinkLimit,
    isCheckingExternalLinks,
    linkDescending,
    linkEvidence,
    linkEvidenceHref,
    linkKind,
    linkQuery,
    linkSort,
    linkStatus,
    navigationRunId,
    result,
    setExternalLinkLimit,
    setLinkDescending,
    setLinkKind,
    setLinkQuery,
    setLinkSort,
    setLinkStatus,
    t,
  } = session;

  const {
    allLinks,
    links,
    internalLinks,
    uniqueInternalTargets,
    checkedInternalTargets,
    brokenInternalTargets,
    uncheckedInternalCount,
    externalLinks,
    uncheckedExternalCount,
    checkedExternalCount,
    blockedExternalCount,
    invalidExternalCount,
  } = computeCrawlLinksData({
    pages: result.pages,
    query: linkQuery,
    kind: linkKind,
    status: linkStatus,
    sort: linkSort,
    descending: linkDescending,
  });

  return (
    <div className="space-y-3">
      <CrawlLinksFilters
        linkQuery={linkQuery}
        setLinkQuery={setLinkQuery}
        linkKind={linkKind}
        setLinkKind={setLinkKind}
        linkStatus={linkStatus}
        setLinkStatus={setLinkStatus}
        linkSort={linkSort}
        setLinkSort={setLinkSort}
        linkDescending={linkDescending}
        setLinkDescending={setLinkDescending}
        navigationRunId={navigationRunId}
        links={links}
        allLinks={allLinks}
        t={t}
      />

      <CrawlLinksInternalSummary
        internalLinksCount={internalLinks.length}
        uniqueCount={uniqueInternalTargets.size}
        checkedCount={checkedInternalTargets.size}
        brokenCount={brokenInternalTargets.size}
        uncheckedCount={uncheckedInternalCount}
        t={t}
      />

      <CrawlLinksExternalCheck
        externalLinksCount={externalLinks.length}
        checkedExternalCount={checkedExternalCount}
        blockedExternalCount={blockedExternalCount}
        invalidExternalCount={invalidExternalCount}
        uncheckedExternalCount={uncheckedExternalCount}
        isCheckingExternalLinks={isCheckingExternalLinks}
        externalLinkCheckProgress={externalLinkCheckProgress}
        externalLinkLimit={externalLinkLimit}
        setExternalLinkLimit={setExternalLinkLimit}
        currentRun={currentRun}
        checkExternalLinks={checkExternalLinks}
        externalError={externalLinkCheckError}
        t={t}
      />

      <CrawlLinksTable
        links={links}
        linkEvidence={linkEvidence ?? undefined}
        linkEvidenceHref={linkEvidenceHref}
        copiedLinkSourceKey={copiedLinkSourceKey}
        copyLinkSource={copyLinkSource}
        t={t}
      />
    </div>
  );
};
