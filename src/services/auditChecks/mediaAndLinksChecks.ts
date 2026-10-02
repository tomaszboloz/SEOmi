import type { PageAuditData } from '@/types';
import i18n from '@/i18n';
import { check, evidence, present, absoluteHttp, uniqueCount, LocalAuditCheck } from './auditChecksBase';

export const buildMediaChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  const images = audit.images || [];
  const finalUrl = audit.final_url || audit.url;
  const finalUrlIsHttps = /^https:\/\//i.test(finalUrl);
  const imageSources = images.map((image) => image.src);

  const missingAlt = images.filter((image) => !image.has_alt).length;
  const emptyAlt = images.filter((image) => image.has_alt && !image.alt?.trim()).length;
  const missingDimensions = images.filter((image) => !present(image.width) || !present(image.height)).length;
  const onlyOneDimension = images.filter((image) => present(image.width) !== present(image.height)).length;
  const lazyImages = images.filter((image) => image.loading?.toLowerCase() === 'lazy').length;
  const srcsetImages = images.filter((image) => present(image.srcset)).length;

  return [
    check('images-alt', 'obrazy', 'images-alt', images.length === 0 ? 'not_applicable' : missingAlt === 0 ? 'pass' : 'warning', images.length === 0 ? evidence('noImages') : evidence('imageAltMissing', { missing: missingAlt, total: images.length })),
    check('images-alt-nonempty', 'obrazy', 'images-alt-nonempty', images.length === 0 ? 'not_applicable' : emptyAlt === 0 ? 'pass' : 'warning', images.length === 0 ? evidence('noImages') : evidence('count', { count: emptyAlt, unit: 'emptyAlt' })),
    check('images-dimensions', 'obrazy', 'images-dimensions', images.length === 0 ? 'not_applicable' : missingDimensions === 0 ? 'pass' : 'warning', images.length === 0 ? evidence('noImages') : evidence('dimensionsMissing', { count: missingDimensions })),
    check('images-dimensions-pair', 'obrazy', 'images-dimensions-pair', images.length === 0 ? 'not_applicable' : onlyOneDimension === 0 ? 'pass' : 'warning', images.length === 0 ? evidence('noImages') : evidence('oneDimension', { count: onlyOneDimension })),
    check('images-loading', 'obrazy', 'images-loading', images.length === 0 ? 'not_applicable' : lazyImages > 0 ? 'pass' : 'warning', images.length === 0 ? evidence('noImages') : evidence('lazy', { lazy: lazyImages, total: images.length })),
    check('images-srcset', 'obrazy', 'images-srcset', images.length === 0 ? 'not_applicable' : srcsetImages > 0 ? 'pass' : 'warning', images.length === 0 ? evidence('noImages') : evidence('srcset', { count: srcsetImages, total: images.length })),
    check('images-modern-format', 'obrazy', 'images-modern-format', images.length === 0 ? 'not_applicable' : images.every((image) => /(?:webp|avif)$/i.test(image.format || image.src)) ? 'pass' : 'warning', images.length === 0 ? evidence('noImages') : images.map((image) => image.format || i18n.t('auditChecks.evidence.formatUnknown')).join(', ')),
    check('images-duplicate-src', 'obrazy', 'images-duplicate-src', uniqueCount(imageSources) === imageSources.length ? 'pass' : 'warning', evidence('countImages', { count: imageSources.length, unique: uniqueCount(imageSources) })),
    check('images-absolute', 'obrazy', 'images-absolute', images.length === 0 ? 'not_applicable' : images.every((image) => absoluteHttp(image.src) || image.src.startsWith('data:') || image.src.startsWith('/')) ? 'pass' : 'warning', evidence('countSources', { count: images.length })),
    check('images-insecure', 'obrazy', 'images-insecure', !finalUrlIsHttps || images.length === 0 ? 'not_applicable' : images.some((image) => /^http:\/\//i.test(image.src)) ? 'error' : 'pass', evidence('countMixedSources', { count: images.filter((image) => /^http:\/\//i.test(image.src)).length })),
    check('images-format-known', 'obrazy', 'images-format-known', images.length === 0 ? 'not_applicable' : images.filter((image) => present(image.format)).length === images.length ? 'pass' : 'warning', `${images.filter((image) => present(image.format)).length}/${images.length}`),
    check('images-data-uri', 'obrazy', 'images-data-uri', images.filter((image) => image.src.startsWith('data:')).length <= 10 ? 'pass' : 'warning', evidence('dataUriCount', { count: images.filter((image) => image.src.startsWith('data:')).length })),
  ];
};

export const buildLinksChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  const links = audit.links || { total_links: 0, internal_links: 0, external_links: 0, nofollow_links: 0, links: [] };
  const finalUrl = audit.final_url || audit.url;
  const finalUrlIsHttps = /^https:\/\//i.test(finalUrl);
  const linkHrefs = links.links.map((link) => link.href);

  const emptyLinks = links.links.filter((link) => !link.text.trim()).length;
  const insecureLinks = links.links.filter((link) => link.is_insecure || /^http:\/\//i.test(link.href)).length;
  const blankWithoutNoopener = links.links.filter((link) => link.target === '_blank' && !/noopener/i.test(link.rel || '')).length;
  const duplicateLinks = linkHrefs.length - uniqueCount(linkHrefs);

  return [
    check('links-total-consistent', 'linki', 'links-total-consistent', links.total_links === links.links.length ? 'pass' : 'warning', evidence('countDeclaredRecords', { declared: links.total_links, records: links.links.length })),
    check('links-internal-external', 'linki', 'links-internal-external', links.internal_links + links.external_links === links.total_links ? 'pass' : 'warning', evidence('linkSplit', { internal: links.internal_links, external: links.external_links })),
    check('links-nofollow-bounded', 'linki', 'links-nofollow-bounded', links.nofollow_links <= links.total_links ? 'pass' : 'error', `${links.nofollow_links}/${links.total_links}`),
    check('links-empty-anchor', 'linki', 'links-empty-anchor', links.links.length === 0 ? 'not_applicable' : emptyLinks === 0 ? 'pass' : 'warning', links.links.length === 0 ? evidence('noLinks') : evidence('countEmpty', { count: emptyLinks, kind: i18n.t('auditChecks.evidence.anchorText') })),
    check('links-insecure', 'linki', 'links-insecure', !finalUrlIsHttps || links.links.length === 0 ? 'not_applicable' : insecureLinks === 0 ? 'pass' : 'warning', evidence('countHttpLinks', { count: insecureLinks })),
    check('links-duplicate', 'linki', 'links-duplicate', duplicateLinks === 0 ? 'pass' : 'warning', evidence('countDuplicates', { count: duplicateLinks })),
    check('links-target-blank', 'linki', 'links-target-blank', blankWithoutNoopener === 0 ? 'pass' : 'warning', evidence('withoutNoopener', { count: blankWithoutNoopener })),
    check('links-href-present', 'linki', 'links-href-present', links.links.every((link) => present(link.href)) ? 'pass' : 'error', `${links.links.filter((link) => present(link.href)).length}/${links.links.length}`),
    check('links-internal-count', 'linki', 'links-internal-count', links.total_links === 0 ? 'not_applicable' : links.internal_links > 0 ? 'pass' : 'warning', `${links.internal_links}`),
    check('links-external-count', 'linki', 'links-external-count', links.total_links === 0 ? 'not_applicable' : links.external_links > 0 ? 'pass' : 'not_applicable', `${links.external_links}`),
    check('links-rel-readable', 'linki', 'links-rel-readable', links.links.every((link) => link.rel === undefined || typeof link.rel === 'string') ? 'pass' : 'error', evidence('relCount', { count: links.links.filter((link) => present(link.rel)).length })),
    check('links-fragments', 'linki', 'links-fragments', links.links.filter((link) => link.href.startsWith('#')).length <= links.links.length ? 'pass' : 'error', evidence('countFragments', { count: links.links.filter((link) => link.href.startsWith('#')).length })),
    check('links-anchor-coverage', 'linki', 'links-anchor-coverage', links.links.length === 0 ? 'not_applicable' : emptyLinks === 0 ? 'pass' : 'warning', `${links.links.length - emptyLinks}/${links.links.length}`),
  ];
};
