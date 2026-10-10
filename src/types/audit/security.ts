export interface SecurityHeaders {
  strict_transport_security?: string;
  content_security_policy?: string;
  content_security_policy_report_only?: string;
  x_frame_options?: string;
  x_content_type_options?: string;
  referrer_policy?: string;
  permissions_policy?: string;
  cross_origin_opener_policy?: string;
  cross_origin_resource_policy?: string;
  server?: string;
  x_powered_by?: string;
  /** Every observed response value, including repeated security headers. */
  repeated_headers?: Record<string, string[]>;
  score: number;
}

export interface CookieSecurityFinding {
  name: string;
  secure: boolean;
  http_only: boolean;
  same_site?: string | null;
}

export interface TransportSecurityAudit {
  scheme: string;
  https: boolean;
  mixed_content_urls: string[];
  cookies: CookieSecurityFinding[];
  tls_coverage: string;
}
