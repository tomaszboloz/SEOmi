export type SerpDevice = 'desktop' | 'mobile';

export interface SerpSitelinkCandidate {
  url: string;
  label: string;
  displayUrl: string;
}

export interface SerpRichResultField {
  label: string;
  value: string;
}

export interface SerpRichResultPreview {
  type: string;
  title: string;
  fields: SerpRichResultField[];
}

export const SERP_VIEWPORTS: Record<SerpDevice, { title: number; snippet: number }> = {
  desktop: { title: 600, snippet: 600 },
  mobile: { title: 340, snippet: 340 },
};

