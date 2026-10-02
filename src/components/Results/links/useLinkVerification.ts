import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LinkData } from '@/types';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { copyText } from '@/services/clipboard';
import { useTransientValue } from '@/hooks/useTransientValue';
export interface LinkVerification {status:number;isBroken:boolean;checking?:boolean;error?:string}
export const useLinkVerification = () => {
 const {t}=useTranslation();
 const [verifiedLinks,setVerifiedLinks]=useState<Record<string,LinkVerification>>({});
 const [isVerifyingBatch,setIsVerifyingBatch]=useState(false);
 const [copiedUrl, setCopiedUrl] = useTransientValue<string|null>(null, 1500);
  const handleCopy = async (href: string) => {
    const copied = await copyText(href);
    if (!copied) return;
    setCopiedUrl(href);
  };

  const handleVerifySingleLink = async (href: string) => {
    setVerifiedLinks((prev) => ({
      ...prev,
      [href]: { status: 0, isBroken: false, checking: true },
    }));

    try {
      const res = await invokeTauriCommand<{
        status: number;
        is_broken: boolean;
      }>("check_link", {
        url: href,
      });
      setVerifiedLinks((prev) => ({
        ...prev,
        [href]: {
          status: res.status,
          isBroken: res.is_broken,
          checking: false,
        },
      }));
    } catch {
      setVerifiedLinks((prev) => ({
        ...prev,
        // A browser preview cannot perform native link checks. Keep this
        // distinct from an HTTP failure so an unavailable desktop bridge does
        // not turn every unverified link into a false broken-link finding.
        [href]: {
          status: 0,
          isBroken: false,
          checking: false,
          error: !isTauriEnvironment() ? t('runtimeErrors.tauri.desktopOnly') : t('legacyUi.links.offline'),
        },
      }));
    }
  };

  const handleVerifyBatch = async (paginatedLinks:LinkData[]) => {
    setIsVerifyingBatch(true);
    const toCheck = paginatedLinks.slice(0, 25);
    for (const l of toCheck) {
      if (!verifiedLinks[l.href]) {
        await handleVerifySingleLink(l.href);
      }
    }
    setIsVerifyingBatch(false);
  };


 return {verifiedLinks,isVerifyingBatch,copiedUrl,handleCopy,handleVerifySingleLink,handleVerifyBatch};
};
