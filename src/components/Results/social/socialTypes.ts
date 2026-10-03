import { PageAuditData } from '@/types';

export interface SocialPreviewProps {
  audit: PageAuditData;
}

export type PlatformTab = 'all' | 'google' | 'facebook' | 'twitter' | 'discord' | 'linkedin' | 'slack' | 'chat';

export interface SerpDraft {
  title: string;
  description: string;
  image: string;
  query: string;
}
