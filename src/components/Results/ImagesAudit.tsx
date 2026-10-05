import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon } from 'lucide-react';
import type { PageAuditData } from '@/types';
import { downloadAuditImagesCsv } from '@/services/export';
import { useAuditStore } from '@/stores/auditStore';
import { copyText } from '@/services/clipboard';
import { ImageMetrics } from './images/ImageMetrics';
import { ImageControls } from './images/ImageControls';
import { ImageCard } from './images/ImageCard';
import { filterAuditImages, isLegacyImage, isModernImage, type ImageFilter } from './images/imagePolicy';
import { useTransientValue } from '@/hooks/useTransientValue';

export const ImagesAudit = ({audit}:{audit:PageAuditData}) => {
 const {t} = useTranslation();
 const [filter,setFilter] = useState<ImageFilter>('all');
 const [search,setSearch] = useState('');
 const [copiedUrl, setCopiedUrl] = useTransientValue<string|null>(null, 1500);
 const problems = useAuditStore(state => state.showOnlyProblems);
 const images = audit.images;
 const missingAltCount = images.filter(img => !img.has_alt).length;
 const missingDimCount = images.filter(img => !img.width || !img.height).length;
 const modernCount = images.filter(img => isModernImage(img.format,img.src)).length;
 const legacyCount = images.filter(img => isLegacyImage(img.format,img.src)).length;
 const filtered = filterAuditImages(images,filter,search,problems);
 const handleCopy = async (url:string) => {
   if (!await copyText(url)) return;
   setCopiedUrl(url); };
 return <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-200">
   <ImageMetrics total={images.length} missingAltCount={missingAltCount} missingDimCount={missingDimCount} modernCount={modernCount} />
   <ImageControls total={images.length} missingAltCount={missingAltCount} missingDimCount={missingDimCount} modernCount={modernCount} legacyCount={legacyCount} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} exportCsv={()=>downloadAuditImagesCsv(audit)} />
   <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden"><div className="divide-y divide-slate-800/80">
     {filtered.length ? filtered.map((img,index)=><ImageCard key={index} img={img} pageUrl={audit.final_url || audit.url} copiedUrl={copiedUrl} handleCopy={handleCopy} />) : <div className="p-12 text-center text-slate-400 text-xs"><ImageIcon className="w-8 h-8 mx-auto mb-2 text-slate-600" />{t('legacyUi.images.empty')}</div>}
   </div></div>
 </div>;
};
