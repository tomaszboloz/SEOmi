export interface HeadingNode {
  level: number;
  text: string;
  children: HeadingNode[];
}

export interface HeadingsStructure {
  h1_count: number;
  h1_texts: string[];
  hierarchy: HeadingNode[];
  has_valid_hierarchy: boolean;
  issues: string[];
}

export interface ImageData {
  src: string;
  alt?: string;
  width?: string;
  height?: string;
  loading?: string;
  srcset?: string;
  has_alt: boolean;
  format?: string;
  dimensions_source?: 'attributes' | 'intrinsic-data-uri' | 'mixed' | string;
}

export interface LinkData {
  href: string;
  text: string;
  is_internal: boolean;
  rel?: string;
  target?: string;
  is_insecure?: boolean;
}

export interface LinksAnalysis {
  total_links: number;
  internal_links: number;
  external_links: number;
  nofollow_links: number;
  links: LinkData[];
}
