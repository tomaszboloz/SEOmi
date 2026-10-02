export interface CrawledImage {
  src: string;
  alt?: string;
  srcset?: string;
  format?: string;
  width?: number;
  height?: number;
  /** Explains whether dimensions came from HTML attributes or local data URI evidence. */
  dimensions_source?: 'attributes' | 'intrinsic-data-uri' | 'mixed' | string;
  lazy_loaded: boolean;
  /** Only true when the optional image-resource request completed in this run. */
  checked_in_run?: boolean;
  http_status?: number | null;
  content_length?: number | null;
  request_error_kind?: string | null;
  srcset_resource_checks?: CrawledImageResourceCheck[];
  srcset_resource_checks_truncated?: boolean;
}

export interface CrawledImageResourceCheck {
  url: string;
  checked_in_run: boolean;
  http_status?: number | null;
  content_length?: number | null;
  request_error_kind?: string | null;
}

export interface CrawledFrame {
  src?: string;
  resolved_url?: string;
  title?: string;
  name?: string;
  loading?: string;
  sandbox?: string;
  checked_in_run?: boolean;
  http_status?: number;
  request_error_kind?: string;
}

export interface CrawledSocialMetaTag {
  key: string;
  /** Missing content and explicitly empty content remain distinct. */
  content?: string | null;
  resource_check?: CrawledSocialResourceCheck | null;
}

export interface CrawledSocialResourceCheck {
  url: string;
  checked_in_run: boolean;
  http_status?: number | null;
  content_type?: string | null;
  content_length?: number | null;
  intrinsic_width?: number | null;
  intrinsic_height?: number | null;
  dimensions_source?: 'intrinsic-http' | string | null;
  request_error_kind?: string | null;
}
