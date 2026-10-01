

import { CrawlerReadinessPanel } from "@/components/Results/CrawlerReadinessPanel";

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlCrawlerReadinessTab = ({ session }: { session: Session }) => {
const { result } = session;
return <CrawlerReadinessPanel result={result} />;
};
