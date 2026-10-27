import type { ContentSection } from '@/types';
import type { BaselineDoc, InfoGainPage } from '@/services/informationGain';
import { createCrawlPageFixture } from './fixtures/crawl';

export const section = (heading: string, text: string, extra: Partial<ContentSection> = {}): ContentSection => ({
  heading, level: heading ? 2 : 0, text, words: text.split(/\s+/).length, tables: 0, lists: 0, ...extra,
});

const DEFINITION = 'The glucose sensor measures glucose in interstitial fluid and sends readings to the smartphone app every five minutes without finger pricks for people with diabetes.';
const INSERTION = 'Clean the skin on the back of the upper arm, press the applicator firmly and remove the needle so the sensor wire stays under the skin for ten days.';
const COSTS = 'Monitoring systems cost money and reimbursement depends on insurance rules, pharmacy margins and the diabetes clinic recommendation for each patient.';

export const competitor = (url: string, rank: number, extra: ContentSection[] = []): BaselineDoc => ({
  url, rank, sections: [section('What is a glucose sensor', DEFINITION), section('How to insert the sensor', INSERTION), section('Costs and reimbursement', COSTS), ...extra],
});

export const SERP_DOCS: BaselineDoc[] = [
  competitor('https://a.example/guide', 1),
  competitor('https://b.example/sensor', 2),
  competitor('https://c.example/cgm', 3),
  competitor('https://d.example/diabetes', 4),
  competitor('https://e.example/insulin', 5),
];

export const ECHO_SECTION = section('What is a glucose sensor', DEFINITION);
export const GAIN_SECTION = section(
  'Compression lows during night testing',
  'In our tests over 14 days we observed compression lows: pressure on the sensor arm lowered the reading by 35-45 mg/dl within 15 minutes while the fingerstick stayed at 105 mg/dl, MARD 8.2% (n = 24).',
  { tables: 1 },
);
export const DRIFT_SECTION = section('Mortgage rates', 'Choosing a mortgage means comparing variable interest, bank margin, down payment, credit score, and a long repayment schedule for the apartment loan.');

export const page = (url: string, sections: ContentSection[], language = 'en'): InfoGainPage =>
  ({ ...createCrawlPageFixture({ url, final_url: url, word_count: 600, semantic_language: language }), content_sections: sections }) as InfoGainPage;
