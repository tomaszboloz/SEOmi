import { expect, it } from 'vitest';
import type { ImageData, LinkData } from '@/types';
import { filterAuditImages, isLegacyImage, isModernImage } from '@/components/Results/images/imagePolicy';
import { filterAuditLinks, hasRelToken, insecureLink, unsafeBlankLink } from '@/components/Results/links/linkPolicy';
const image:ImageData={src:'https://example.test/coffee',has_alt:false,alt:'Coffee',format:'webp'};
const link:LinkData={href:'http://example.test/coffee',text:'Coffee',is_internal:false,target:'_blank',rel:'NOFOLLOW'};
it('recognizes format evidence and does not classify unknown formats as known',()=>{
 for(const format of ['WEBP','avif','svg'])expect(isModernImage(format)).toBe(true);
 for(const format of ['png','JPEG','jpg','gif'])expect(isLegacyImage(format)).toBe(true);
 expect(isModernImage(undefined,'https://example.test/a.webp')).toBe(true);
 expect(isLegacyImage(undefined,'https://example.test/a.jpg')).toBe(true);
 expect(isModernImage()).toBe(false);expect(isLegacyImage()).toBe(false);
 expect(isModernImage('bmp')).toBe(false);expect(isLegacyImage('bmp')).toBe(false);
});
it('filters images from observed source, alt and format evidence without mutating input',()=>{
 expect(filterAuditImages([image],'all',' coffee ',false)).toEqual([image]);
 expect(filterAuditImages([image],'modern','WEBP',true)).toEqual([image]);
 expect(filterAuditImages([image],'legacy','',false)).toEqual([]);
 expect(filterAuditImages([image],'all','absent',false)).toEqual([]);
 expect(image).toEqual({src:'https://example.test/coffee',has_alt:false,alt:'Coffee',format:'webp'});
});
it('treats rel as HTML whitespace separated case-insensitive tokens',()=>{
 expect(hasRelToken('sponsored\tNOFOLLOW\nnoopener\fexternal\r','nofollow')).toBe(true);
 expect(hasRelToken('xnofollow','nofollow')).toBe(false);expect(hasRelToken(undefined,'nofollow')).toBe(false);
 expect(unsafeBlankLink(link)).toBe(true);expect(unsafeBlankLink({...link,rel:'NOOPENER'})).toBe(false);
 expect(unsafeBlankLink({...link,rel:'noreferrer'})).toBe(false);expect(unsafeBlankLink({...link,target:'_self'})).toBe(false);
});
it('distinguishes mixed HTTP links from explicit insecure findings',()=>{
 expect(insecureLink(link,true)).toBe(true);expect(insecureLink(link,false)).toBe(false);
 expect(insecureLink({...link,href:'https://example.test',is_insecure:true},false)).toBe(true);
});
it('retains verified broken links in problem mode and applies evidence filters',()=>{
 const safe={...link,href:'https://example.test',rel:'noopener'};
 expect(filterAuditLinks([safe],'all','',true,true,{})).toEqual([]);
 expect(filterAuditLinks([safe],'all','',true,true,{[safe.href]:{status:404,isBroken:true}})).toEqual([safe]);
 expect(filterAuditLinks([link],'external','coffee',false,true,{})).toEqual([link]);
 expect(filterAuditLinks([link],'internal','',false,true,{})).toEqual([]);
 expect(filterAuditLinks([link],'security','',false,true,{})).toEqual([link]);
 expect(filterAuditLinks([link],'nofollow','',false,true,{})).toEqual([link]);
});
