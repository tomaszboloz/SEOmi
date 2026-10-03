export type IssueSeverity = 'Critical' | 'Warning' | 'Info';

export type IssueCategory =
  | 'MetaTags'
  | 'OpenGraph'
  | 'TwitterCard'
  | 'Headings'
  | 'Images'
  | 'Links'
  | 'Security'
  | 'Performance'
  | 'Technical'
  | 'StructuredData';

export interface Issue {
  severity: IssueSeverity;
  category: IssueCategory;
  /** Stable backend identifier for localized audit findings. */
  code?: string;
  /** Values used by the localized message/recommendation templates. */
  params?: Record<string, string>;
  message: string;
  recommendation?: string;
}

export interface RedirectHop {
  url: string;
  status_code: u16;
  location?: string;
}

export type u16 = number;

export type u8 = number;
