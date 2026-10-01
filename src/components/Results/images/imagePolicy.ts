import type { ImageData } from '@/types';
export type ImageFilter = 'all' | 'missing-alt' | 'missing-dim' | 'legacy' | 'modern';
export const isModernImage = (format?:string,src?:string) => ['webp','avif','svg'].includes((format || '').toLowerCase()) || /\.(webp|avif|svg)$/i.test(src || '');
export const isLegacyImage = (format?:string,src?:string) => ['png','jpeg','jpg','gif'].includes((format || '').toLowerCase()) || /\.(png|jpe?g|gif)$/i.test(src || '');
export const filterAuditImages = (images:ImageData[],filter:ImageFilter,search:string,problems:boolean) => images.filter(img => {
 if (problems && img.has_alt && img.width && img.height) return false;
 if (filter === 'missing-alt' && img.has_alt) return false;
 if (filter === 'missing-dim' && img.width && img.height) return false;
 if (filter === 'legacy' && !isLegacyImage(img.format,img.src)) return false;
 if (filter === 'modern' && !isModernImage(img.format,img.src)) return false;
 const query = search.trim().toLowerCase();
 return !query || [img.src,img.alt || '',img.format || ''].some(value => value.toLowerCase().includes(query));
});
