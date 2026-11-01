import { z } from 'zod';

/**
 * Additive data contracts for later modules (#85 GEM-85-09): reporting periods with currency, backlink and
 * mention draft revisions, media regions (bbox / timecode), interventions and hreflang mappings.
 * Each is parsed at the boundary; unknown optional fields stay absent (null), never 0.
 */
const iso = z.string().refine((value) => Number.isFinite(Date.parse(value)), 'invalid date');
const unit = z.number().min(0).max(1);

export const PeriodSchema = z.object({
  start: iso,
  end: iso,
  currency: z.string().regex(/^[A-Z]{3}$/u, 'ISO 4217').nullable().optional(),
}).refine((period) => Date.parse(period.end) >= Date.parse(period.start), { message: 'end before start', path: ['end'] });

export const DraftRevisionSchema = z.object({
  draftId: z.string().trim().min(1),
  kind: z.enum(['backlink', 'mention']),
  revision: z.number().int().min(1),
  parentRevision: z.number().int().min(1).nullable(),
  createdAt: iso,
  contentHash: z.string().regex(/^[0-9a-f]{16}$/u),
}).refine((draft) => draft.parentRevision === null ? draft.revision === 1 : draft.parentRevision < draft.revision, { message: 'bad parent', path: ['parentRevision'] });

export const MediaRegionSchema = z.object({
  mediaUrl: z.string().trim().min(1),
  bbox: z.object({ x: unit, y: unit, width: unit, height: unit }).nullable().optional(),
  timecode: z.object({ startMs: z.number().int().min(0), endMs: z.number().int().min(0) })
    .refine((span) => span.endMs >= span.startMs, 'end before start').nullable().optional(),
}).refine((region) => Boolean(region.bbox) || Boolean(region.timecode), { message: 'bbox or timecode required', path: ['bbox'] });

export const InterventionSchema = z.object({
  id: z.string().trim().min(1),
  type: z.string().trim().min(1),
  appliedAt: iso,
  urls: z.array(z.string().trim().min(1)).max(1000),
});

export const HreflangMappingSchema = z.object({
  url: z.string().trim().min(1),
  hreflang: z.string().regex(/^(x-default|[a-z]{2,3}(-[A-Za-z0-9]{2,8})*)$/u),
  canonical: z.string().trim().min(1).nullable().optional(),
});

export type Period = z.infer<typeof PeriodSchema>;
export type DraftRevision = z.infer<typeof DraftRevisionSchema>;
export type MediaRegion = z.infer<typeof MediaRegionSchema>;
export type Intervention = z.infer<typeof InterventionSchema>;
export type HreflangMapping = z.infer<typeof HreflangMappingSchema>;
