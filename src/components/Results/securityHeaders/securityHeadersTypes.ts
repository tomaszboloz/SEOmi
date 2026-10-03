import type { TFunction } from 'i18next';
import type { PageAuditData } from '@/types';

export interface HeaderSpec {
  key: string;
  title: string;
  value: string | undefined;
  importance: 'Critical' | 'High' | 'Medium';
  expected: string;
  remediation: string;
}

export const buildHeaderSpecs = (
  headers: PageAuditData['security_headers'],
  t: TFunction,
): HeaderSpec[] => [
  {
    key: 'strict-transport-security',
    title: t('security.hstsTitle'),
    value: headers.strict_transport_security,
    importance: 'Critical',
    expected: 'max-age=31536000; includeSubDomains; preload',
    remediation: t('legacyUi.security.hstsRemediation'),
  },
  {
    key: 'content-security-policy',
    title: t('security.cspTitle'),
    value: headers.content_security_policy,
    importance: 'Critical',
    expected: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';",
    remediation: t('legacyUi.security.cspRemediation'),
  },
  {
    key: 'x-frame-options',
    title: t('security.xfoTitle'),
    value: headers.x_frame_options,
    importance: 'High',
    expected: 'DENY or SAMEORIGIN',
    remediation: t('legacyUi.security.xfoRemediation'),
  },
  {
    key: 'x-content-type-options',
    title: t('security.xxpTitle'),
    value: headers.x_content_type_options,
    importance: 'High',
    expected: 'nosniff',
    remediation: t('legacyUi.security.xctoRemediation'),
  },
  {
    key: 'referrer-policy',
    title: t('security.referrerTitle'),
    value: headers.referrer_policy,
    importance: 'Medium',
    expected: 'strict-origin-when-cross-origin',
    remediation: t('legacyUi.security.referrerRemediation'),
  },
  {
    key: 'permissions-policy',
    title: t('security.permissionsTitle'),
    value: headers.permissions_policy,
    importance: 'Medium',
    expected: 'camera=(), microphone=(), geolocation=()',
    remediation: t('legacyUi.security.permissionsRemediation'),
  },
  {
    key: 'cross-origin-opener-policy',
    title: t('security.coopTitle'),
    value: headers.cross_origin_opener_policy,
    importance: 'Medium',
    expected: 'same-origin',
    remediation: t('legacyUi.security.coopRemediation'),
  },
  {
    key: 'cross-origin-resource-policy',
    title: t('security.corpTitle'),
    value: headers.cross_origin_resource_policy,
    importance: 'Medium',
    expected: 'same-origin',
    remediation: t('legacyUi.security.corpRemediation'),
  },
];
