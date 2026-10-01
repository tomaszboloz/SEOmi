import i18n from '@/i18n';

import type { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';

export type Session = ReturnType<typeof useSiteAuditSession>;

export const session = (patch: Partial<Session>): Session => ({ t: i18n.t.bind(i18n), ...patch } as Session);
