import type { GscPerformanceFilters } from '@/types';

export const normalizedFilters = (filters?: GscPerformanceFilters): GscPerformanceFilters => ({
  ...(filters?.search_type ? { search_type: filters.search_type } : {}),
  ...(filters?.device ? { device: filters.device } : {}),
  ...(filters?.country?.trim() ? { country: filters.country.trim().toLowerCase() } : {}),
});

export const filtersEqual = (left?: GscPerformanceFilters, right?: GscPerformanceFilters): boolean => {
  const a = normalizedFilters(left);
  const b = normalizedFilters(right);
  return (a.search_type || null) === (b.search_type || null)
    && (a.device || null) === (b.device || null)
    && (a.country || null) === (b.country || null);
};

