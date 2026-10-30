import { useTranslation } from 'react-i18next';
import type { SourceProvenance, UrlTelemetrySnapshot } from '@/services/urlTelemetry';

const SOURCES = ['gsc', 'ga4', 'backlinks', 'revenue'] as const;
const UNAVAILABLE: SourceProvenance = { state: 'unavailable' };

export const TelemetrySources = ({ snapshot }: { snapshot: UrlTelemetrySnapshot | null }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-1 rounded border border-white/10 p-2" data-testid="telemetry-sources">
      <h4 className="font-semibold">{t('telemetrySourcesUi.title')}</h4>
      <dl className="space-y-1">
        {SOURCES.map((name) => {
          const source = snapshot?.sources[name] ?? UNAVAILABLE;
          return (
            <div key={name} className="flex flex-wrap gap-x-2" data-testid={`telemetry-source-${name}`}>
              <dt className="font-semibold">{t(`telemetrySourcesUi.sources.${name}`)}</dt>
              <dd>{t(`telemetrySourcesUi.states.${source.state}`)}</dd>
              {source.property && <dd>{t('telemetrySourcesUi.property', { value: source.property })}</dd>}
              {source.provider && <dd>{t('telemetrySourcesUi.provider', { value: source.provider })}</dd>}
              {source.period && <dd>{t('telemetrySourcesUi.period', source.period)}</dd>}
              {source.retrievedAt && <dd>{t('telemetrySourcesUi.retrievedAt', { value: source.retrievedAt })}</dd>}
              {source.truncated !== undefined && <dd>{t(`telemetrySourcesUi.truncated.${source.truncated ? 'yes' : 'no'}`)}</dd>}
              {source.coveragePct != null && <dd>{t('telemetrySourcesUi.coverage', { value: source.coveragePct })}</dd>}
              {source.currency && <dd>{t('telemetrySourcesUi.currency', { value: source.currency })}</dd>}
              {source.attribution && <dd>{t(`telemetrySourcesUi.attribution.${source.attribution}`)}</dd>}
            </div>
          );
        })}
      </dl>
      <p>{t('telemetrySourcesUi.unknownNote')}</p>
    </div>
  );
};
