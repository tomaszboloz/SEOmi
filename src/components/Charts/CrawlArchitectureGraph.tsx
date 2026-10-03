import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CrawlArchitectureHeader } from './crawlArchitecture/CrawlArchitectureHeader';
import { CrawlArchitectureBottomNav } from './crawlArchitecture/CrawlArchitectureBottomNav';
import { CrawlArchitectureMainContent } from './crawlArchitecture/CrawlArchitectureMainContent';
import { useCrawlArchitectureState } from './crawlArchitecture/useCrawlArchitectureState';
import type { CrawlArchitectureGraphProps } from './crawlArchitecture/CrawlArchitectureTypes';

export const CrawlArchitectureGraph = (props: CrawlArchitectureGraphProps) => {
  const { t } = useTranslation();
  const state = useCrawlArchitectureState(props);
  const mapTabsRef = useRef<HTMLDivElement | null>(null);
  const bottomMapTabsRef = useRef<HTMLDivElement | null>(null);
  const { activeView, setActiveView } = state;

  useEffect(() => {
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth';
    [mapTabsRef, bottomMapTabsRef].forEach((ref) => {
      ref.current?.querySelector<HTMLElement>('[aria-selected="true"], [aria-pressed="true"]')?.scrollIntoView?.({
        behavior, block: 'nearest', inline: 'center',
      });
    });
  }, [activeView]);

  return (
    <section id="crawl-map-visualisation" aria-label={t('mapUi.sectionAria')} tabIndex={-1} className="scroll-pb-48 rounded-xl border border-slate-800 bg-slate-900/45 p-4 pb-48 outline-none md:scroll-pb-40 md:pb-40">
      <CrawlArchitectureHeader activeView={activeView} setActiveView={setActiveView} mapTabsRef={mapTabsRef} />
      <div id="crawl-map-view-panel" role="tabpanel" aria-labelledby={`crawl-map-view-${activeView}`}>
        <CrawlArchitectureMainContent {...props} state={state} />
      </div>
      <CrawlArchitectureBottomNav activeView={activeView} setActiveView={setActiveView} bottomMapTabsRef={bottomMapTabsRef} />
    </section>
  );
};
