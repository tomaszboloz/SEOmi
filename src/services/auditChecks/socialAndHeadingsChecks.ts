import type { PageAuditData } from '@/types';
import i18n from '@/i18n';
import { check, evidence, present, absoluteHttp, uniqueCount, LocalAuditCheck } from './auditChecksBase';

export const buildOpenGraphChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  const og = audit.open_graph;
  const finalUrl = audit.final_url || audit.url;
  const title = audit.meta_tags.title?.trim() || '';
  const ogTags = og.all_tags || [];

  return [
    check('og-title', 'openGraph', 'og-title', present(og.og_title) ? 'pass' : 'warning', og.og_title || evidence('missingOgTitle')),
    check('og-description', 'openGraph', 'og-description', present(og.og_description) ? 'pass' : 'warning', og.og_description || evidence('missingOgDescription')),
    check('og-image', 'openGraph', 'og-image', present(og.og_image) ? 'pass' : 'warning', og.og_image || evidence('missingOgImage')),
    check('og-image-absolute', 'openGraph', 'og-image-absolute', !og.og_image ? 'not_applicable' : absoluteHttp(og.og_image) ? 'pass' : 'warning', og.og_image || evidence('missingOgImage')),
    check('og-image-dimensions', 'openGraph', 'og-image-dimensions', !og.og_image ? 'not_applicable' : present(og.og_image_width) && present(og.og_image_height) ? 'pass' : 'warning', og.og_image ? evidence('dimensions', { width: og.og_image_width || i18n.t('auditProblems.unknown'), height: og.og_image_height || i18n.t('auditProblems.unknown') }) : evidence('missingImage')),
    check('og-url', 'openGraph', 'og-url', present(og.og_url) ? 'pass' : 'warning', og.og_url || evidence('missingOgUrl')),
    check('og-url-match', 'openGraph', 'og-url-match', !og.og_url ? 'not_applicable' : og.og_url === finalUrl ? 'pass' : 'warning', og.og_url || evidence('missingOgUrl')),
    check('og-type', 'openGraph', 'og-type', present(og.og_type) ? 'pass' : 'warning', og.og_type || evidence('missingOgType')),
    check('og-site-name', 'openGraph', 'og-site-name', present(og.og_site_name) ? 'pass' : 'not_applicable', og.og_site_name || evidence('notDeclared')),
    check('og-locale', 'openGraph', 'og-locale', present(og.og_locale) ? 'pass' : 'not_applicable', og.og_locale || evidence('notDeclared')),
    check('og-tag-duplicates', 'openGraph', 'og-tag-duplicates', uniqueCount(ogTags.map((tag) => tag.property || tag.name || '')) === ogTags.length ? 'pass' : 'warning', evidence('countTags', { count: ogTags.length, unique: uniqueCount(ogTags.map((tag) => tag.property || tag.name || '')) })),
    check('og-title-alignment', 'openGraph', 'og-title-alignment', !og.og_title || !title ? 'not_applicable' : og.og_title.trim() === title ? 'pass' : 'warning', og.og_title || evidence('missingOgTitle')),
  ];
};

export const buildTwitterCardChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  const twitter = audit.twitter_card;
  const title = audit.meta_tags.title?.trim() || '';
  const twitterTags = twitter.all_tags || [];

  return [
    check('twitter-card', 'twitterCard', 'twitter-card', present(twitter.twitter_card) ? 'pass' : 'warning', twitter.twitter_card || evidence('missingTwitterCard')),
    check('twitter-title', 'twitterCard', 'twitter-title', present(twitter.twitter_title) ? 'pass' : 'warning', twitter.twitter_title || evidence('missingTwitterTitle')),
    check('twitter-description', 'twitterCard', 'twitter-description', present(twitter.twitter_description) ? 'pass' : 'warning', twitter.twitter_description || evidence('missingTwitterDescription')),
    check('twitter-image', 'twitterCard', 'twitter-image', present(twitter.twitter_image) ? 'pass' : 'warning', twitter.twitter_image || evidence('missingTwitterImage')),
    check('twitter-image-absolute', 'twitterCard', 'twitter-image-absolute', !twitter.twitter_image ? 'not_applicable' : absoluteHttp(twitter.twitter_image) ? 'pass' : 'warning', twitter.twitter_image || evidence('missingImage')),
    check('twitter-site', 'twitterCard', 'twitter-site', present(twitter.twitter_site) ? 'pass' : 'not_applicable', twitter.twitter_site || evidence('notDeclared')),
    check('twitter-creator', 'twitterCard', 'twitter-creator', present(twitter.twitter_creator) ? 'pass' : 'not_applicable', twitter.twitter_creator || evidence('notDeclared')),
    check('twitter-tags-duplicates', 'twitterCard', 'twitter-tags-duplicates', uniqueCount(twitterTags.map((tag) => tag.property || tag.name || '')) === twitterTags.length ? 'pass' : 'warning', evidence('countTags', { count: twitterTags.length, unique: uniqueCount(twitterTags.map((tag) => tag.property || tag.name || '')) })),
    check('twitter-card-supported', 'twitterCard', 'twitter-card-supported', !twitter.twitter_card ? 'not_applicable' : /^(summary|summary_large_image|app|player)$/i.test(twitter.twitter_card.trim()) ? 'pass' : 'warning', twitter.twitter_card || evidence('missingType')),
    check('twitter-title-alignment', 'twitterCard', 'twitter-title-alignment', !twitter.twitter_title || !title ? 'not_applicable' : twitter.twitter_title.trim() === title ? 'pass' : 'warning', twitter.twitter_title || evidence('missingTwitterTitle')),
  ];
};

export const buildHeadingsChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  const headings = audit.headings;
  const allHeadingTexts = (headings.hierarchy || []).map((node) => node.text.trim()).filter(Boolean);
  const firstHeadingLevel = headings.hierarchy?.[0]?.level;

  return [
    check('h1', 'nagOwki', 'h1', headings.h1_count === 1 ? 'pass' : headings.h1_count === 0 ? 'error' : 'warning', evidence('detectedH1', { count: headings.h1_count })),
    check('h1-nonempty', 'nagOwki', 'h1-nonempty', headings.h1_texts.length > 0 && headings.h1_texts.every((text) => text.trim()) ? 'pass' : 'error', headings.h1_texts.join(' · ') || evidence('missingH1Text')),
    check('heading-hierarchy', 'nagOwki', 'heading-hierarchy', headings.has_valid_hierarchy ? 'pass' : 'warning', headings.issues.join(' ') || evidence('noHeadingJumps')),
    check('heading-first-level', 'nagOwki', 'heading-first-level', firstHeadingLevel === undefined ? 'not_applicable' : firstHeadingLevel === 1 ? 'pass' : 'warning', firstHeadingLevel === undefined ? evidence('noHeadings') : evidence('firstHeading', { level: firstHeadingLevel })),
    check('heading-unique-h1', 'nagOwki', 'heading-unique-h1', uniqueCount(headings.h1_texts) === headings.h1_texts.length ? 'pass' : 'warning', evidence('countTexts', { count: headings.h1_texts.length, unique: uniqueCount(headings.h1_texts) })),
    check('heading-nonempty-all', 'nagOwki', 'heading-nonempty-all', allHeadingTexts.length === headings.hierarchy.length ? 'pass' : 'warning', evidence('headingTextCoverage', { withText: allHeadingTexts.length, total: headings.hierarchy.length })),
    check('heading-depth', 'nagOwki', 'heading-depth', headings.hierarchy.every((node) => node.level >= 1 && node.level <= 6) ? 'pass' : 'error', evidence('countNodes', { count: headings.hierarchy.length })),
    check('heading-issues', 'nagOwki', 'heading-issues', headings.issues.length === 0 ? 'pass' : 'warning', headings.issues.join(' ') || evidence('noProblems')),
    check('heading-count', 'nagOwki', 'heading-count', Number.isFinite(headings.hierarchy.length) ? 'pass' : 'error', `${headings.hierarchy.length}`),
    check('heading-text-coverage', 'nagOwki', 'heading-text-coverage', headings.hierarchy.length === 0 ? 'not_applicable' : allHeadingTexts.length === headings.hierarchy.length ? 'pass' : 'warning', `${allHeadingTexts.length}/${headings.hierarchy.length}`),
  ];
};
