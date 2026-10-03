import type { LinkData } from '@/types';
import type { LinkVerification } from './useLinkVerification';
export type LinkFilter = 'all' | 'internal' | 'external' | 'security' | 'nofollow';
export const hasRelToken = (rel:string|undefined,token:string) => (rel || '').toLowerCase().split(/[\t\n\f\r ]+/).includes(token);
export const unsafeBlankLink = (link:LinkData) => link.target === '_blank' && !hasRelToken(link.rel,'noopener') && !hasRelToken(link.rel,'noreferrer');
export const insecureLink = (link:LinkData,https:boolean) => Boolean(link.is_insecure || (https && link.href.toLowerCase().startsWith('http://')));
export const filterAuditLinks = (links:LinkData[],filter:LinkFilter,search:string,problems:boolean,https:boolean,verified:Record<string,LinkVerification>) => links.filter(link => {
 const unsafe=unsafeBlankLink(link); const insecure=insecureLink(link,https);
 if (problems && !unsafe && !insecure && !verified[link.href]?.isBroken) return false;
 if (filter === 'internal' && !link.is_internal) return false;
 if (filter === 'external' && link.is_internal) return false;
 if (filter === 'security' && !unsafe && !insecure) return false;
 if (filter === 'nofollow' && !hasRelToken(link.rel,'nofollow')) return false;
 const query=search.trim().toLowerCase();
 return !query || link.href.toLowerCase().includes(query) || link.text.toLowerCase().includes(query);
});
