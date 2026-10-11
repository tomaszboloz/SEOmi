import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import i18n from '@/i18n';
import { DiagnosisStats } from '@/components/Charts/crawlArchitecture/topicalDiagnosis/DiagnosisStats';

it('renders every DiagnosisStats field through the public component', async () => {
  await i18n.changeLanguage('en');
  render(<DiagnosisStats stats={{ pages: 8, skippedPages: 2, documents: 6, hubs: 1, utilities: 1, topics: 3, singletons: 2, languages: ['en', 'pl'], mergedPairs: 4 }} />);
  const view = screen.getByLabelText('Topical diagnosis');
  expect([...view.querySelectorAll('div')].map((entry) => entry.textContent?.trim())).toEqual([
    'Documents: 6', 'Pages: 8', 'Skipped: 2', 'Hubs: 1', 'Topics: 3', 'Singletons: 2',
    'Language pairs: 4', 'Languages: en, pl',
  ]);
});
