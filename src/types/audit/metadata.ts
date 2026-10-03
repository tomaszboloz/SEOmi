export interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

export interface MetaTags {
  title?: string;
  title_length: number;
  description?: string;
  description_length: number;
  keywords?: string;
  robots?: string;
  canonical?: string;
  viewport?: string;
  charset?: string;
  author?: string;
  generator?: string;
  theme_color?: string;
  other_tags: MetaTag[];
}

export interface OpenGraphData {
  og_title?: string;
  og_description?: string;
  og_image?: string;
  og_image_width?: string;
  og_image_height?: string;
  og_url?: string;
  og_type?: string;
  og_site_name?: string;
  og_locale?: string;
  all_tags: MetaTag[];
}

export interface TwitterCardData {
  twitter_card?: string;
  twitter_site?: string;
  twitter_creator?: string;
  twitter_title?: string;
  twitter_description?: string;
  twitter_image?: string;
  all_tags: MetaTag[];
}
