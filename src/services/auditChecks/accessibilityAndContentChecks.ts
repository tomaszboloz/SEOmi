import type { PageAuditData } from '@/types';
import i18n from '@/i18n';
import { check, evidence, present, absoluteHttp, LocalAuditCheck } from './auditChecksBase';

export const buildAccessibilityChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  const accessibility = audit.accessibility;
  const mainLandmark = accessibility?.landmarks.find((landmark) => landmark.name.toLowerCase() === 'main');
  const totalLandmarks = accessibility?.landmarks.reduce((sum, landmark) => sum + landmark.count, 0) || 0;

  return [
    check('accessibility-language', 'dostepnosc', 'accessibility-language', !accessibility ? 'not_applicable' : present(accessibility.document_language) ? 'pass' : 'warning', accessibility?.document_language || evidence('missingLanguage')),
    check('accessibility-basics', 'dostepnosc', 'accessibility-basics', !accessibility ? 'not_applicable' : !accessibility.document_language || accessibility.unlabeled_form_control_count > 0 ? 'warning' : 'pass', !accessibility ? evidence('accessibilityPending') : evidence('accessibilitySummary', { language: accessibility.document_language || i18n.t('auditChecks.evidence.noDataWord'), landmarks: accessibility.landmarks.map((landmark) => `${landmark.name} (${landmark.count})`).join(', ') || i18n.t('auditChecks.evidence.noDataWord'), unlabeled: accessibility.unlabeled_form_control_count })),
    check('accessibility-main', 'dostepnosc', 'accessibility-main', !accessibility ? 'not_applicable' : mainLandmark?.count === 1 ? 'pass' : 'warning', accessibility ? evidence('mainLandmark', { count: mainLandmark?.count || 0 }) : evidence('missingReport')),
    check('accessibility-landmarks', 'dostepnosc', 'accessibility-landmarks', !accessibility ? 'not_applicable' : totalLandmarks > 0 ? 'pass' : 'warning', accessibility ? evidence('countLandmarks', { count: totalLandmarks }) : evidence('missingReport')),
    check('accessibility-aria-count', 'dostepnosc', 'accessibility-aria-count', !accessibility ? 'not_applicable' : Number.isFinite(accessibility.aria_attribute_count) ? 'pass' : 'error', accessibility ? String(accessibility.aria_attribute_count) : evidence('missingReport')),
    check('accessibility-form-controls', 'dostepnosc', 'accessibility-form-controls', !accessibility ? 'not_applicable' : Number.isFinite(accessibility.form_control_count) ? 'pass' : 'error', accessibility ? `${accessibility.form_control_count}` : evidence('missingReport')),
    check('accessibility-labels', 'dostepnosc', 'accessibility-labels', !accessibility ? 'not_applicable' : accessibility.unlabeled_form_control_count === 0 ? 'pass' : 'warning', accessibility ? evidence('countUnlabeled', { count: accessibility.unlabeled_form_control_count }) : evidence('missingReport')),
    check('accessibility-hidden-controls', 'dostepnosc', 'accessibility-hidden-controls', !accessibility ? 'not_applicable' : 'pass', accessibility ? evidence('countHidden', { count: accessibility.hidden_form_control_count || 0 }) : evidence('missingReport')),
    check('accessibility-honeypot', 'dostepnosc', 'accessibility-honeypot', !accessibility ? 'not_applicable' : 'pass', accessibility ? evidence('countHoneypots', { count: accessibility.anti_spam_text_control_count || 0 }) : evidence('missingReport')),
    check('accessibility-evidence', 'dostepnosc', 'accessibility-evidence', !accessibility ? 'not_applicable' : (accessibility.findings || []).every((finding) => present(finding.evidence) && present(finding.recommendation)) ? 'pass' : 'warning', accessibility ? evidence('countFindings', { count: accessibility.findings?.length || 0 }) : evidence('missingReport')),
    check('accessibility-manual-review', 'dostepnosc', 'accessibility-manual-review', !accessibility ? 'not_applicable' : 'pass', accessibility ? evidence('countManual', { count: accessibility.manual_review_items.length }) : evidence('missingReport')),
  ];
};

export const buildContentChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  const content = audit.content_stats;
  const topKeywordDensity = content.top_keywords.reduce((sum, term) => sum + (term.density_percent || 0), 0);

  return [
    check('content-word-count', 'tresc', 'content-word-count', Number.isFinite(content.word_count) ? content.word_count > 0 ? 'pass' : 'warning' : 'error', evidence('countWords', { count: content.word_count })),
    check('content-reading-time', 'tresc', 'content-reading-time', Number.isFinite(content.reading_time_minutes) ? 'pass' : 'error', evidence('countMinutes', { count: content.reading_time_minutes })),
    check('content-text-ratio', 'tresc', 'content-text-ratio', Number.isFinite(content.text_ratio_percent) ? content.text_ratio_percent > 0 ? 'pass' : 'warning' : 'error', `${content.text_ratio_percent}%`),
    check('content-sentence-count', 'tresc', 'content-sentence-count', content.sentence_count === undefined ? 'not_applicable' : content.sentence_count > 0 ? 'pass' : 'warning', content.sentence_count === undefined ? evidence('legacyMetricMissing') : `${content.sentence_count}`),
    check('content-average-sentence', 'tresc', 'content-average-sentence', content.average_words_per_sentence === undefined ? 'not_applicable' : content.average_words_per_sentence <= 30 ? 'pass' : 'warning', content.average_words_per_sentence === undefined ? evidence('missingData') : evidence('countWords', { count: content.average_words_per_sentence.toFixed(1) })),
    check('content-average-word', 'tresc', 'content-average-word', content.average_characters_per_word === undefined ? 'not_applicable' : content.average_characters_per_word <= 12 ? 'pass' : 'warning', content.average_characters_per_word === undefined ? evidence('missingData') : evidence('countCharacters', { count: content.average_characters_per_word.toFixed(1) })),
    check('content-complexity', 'tresc', 'content-complexity', content.complexity_score === undefined ? 'not_applicable' : content.complexity_score <= 70 ? 'pass' : 'warning', content.complexity_score === undefined ? evidence('missingData') : `${content.complexity_score}/100`),
    check('content-readability', 'tresc', 'content-readability', content.readability_ease_score === undefined ? 'not_applicable' : content.readability_ease_score >= 50 ? 'pass' : 'warning', content.readability_ease_score === undefined ? evidence('missingData') : `${content.readability_ease_score.toFixed(1)}/100`),
    check('content-readability-grade', 'tresc', 'content-readability-grade', content.readability_grade === undefined ? 'not_applicable' : content.readability_grade <= 12 ? 'pass' : 'warning', content.readability_grade === undefined ? evidence('missingData') : `${content.readability_grade.toFixed(1)}`),
    check('content-keyword-density', 'tresc', 'content-keyword-density', topKeywordDensity <= 25 ? 'pass' : 'warning', `${topKeywordDensity.toFixed(2)}%`),
    check('content-truncation', 'tresc', 'content-truncation', content.body_text_truncated === true ? 'warning' : content.body_text !== undefined ? 'pass' : 'not_applicable', content.body_text_truncated ? evidence('contentTruncated') : content.body_text !== undefined ? evidence('countCharacters', { count: content.body_text.length }) : evidence('legacyBodyTextMissing')),
  ];
};

export const buildAmpAndTransportChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  const amp = audit.amp;
  const transport = audit.transport_security;
  const finalUrl = audit.final_url || audit.url;
  const finalUrlIsHttps = /^https:\/\//i.test(finalUrl);

  return [
    check('amp-detected', 'amp', 'amp-detected', !amp ? 'not_applicable' : amp.detected ? 'pass' : 'not_applicable', amp ? (amp.detected ? evidence('ampDetected') : evidence('ampNotDetected')) : evidence('ampReportMissing')),
    check('amp-document-consistency', 'amp', 'amp-document-consistency', !amp ? 'not_applicable' : amp.is_amp_document === amp.detected || !amp.detected ? 'pass' : 'warning', amp ? evidence('ampConsistency', { detected: i18n.t(amp.detected ? 'auditChecks.evidence.ampDetectedState' : 'auditChecks.evidence.ampNotDetectedState'), document: i18n.t(amp.is_amp_document ? 'auditChecks.evidence.ampDocumentState' : 'auditChecks.evidence.ampRegularState') }) : evidence('missingData')),
    check('amp-canonical', 'amp', 'amp-canonical', !amp || !amp.is_amp_document ? 'not_applicable' : present(amp.canonical_url) ? 'pass' : 'warning', amp?.canonical_url || evidence('missingAmpCanonical')),
    check('amp-alternate-urls', 'amp', 'amp-alternate-urls', !amp || amp.amphtml_urls.length === 0 ? 'not_applicable' : amp.amphtml_urls.every((url) => absoluteHttp(url)) ? 'pass' : 'warning', amp ? evidence('countGoals', { count: amp.amphtml_urls.length }) : evidence('missingData')),
    check('amp-findings', 'amp', 'amp-findings', !amp || amp.findings.length === 0 ? 'not_applicable' : amp.findings.every((finding) => present(finding.recommendation)) ? 'pass' : 'warning', amp ? evidence('countFindings', { count: amp.findings.length }) : evidence('missingData')),
    check('amp-unchecked', 'amp', 'amp-unchecked', !amp ? 'not_applicable' : 'pass', amp ? evidence('countUnverified', { count: amp.unchecked.length }) : evidence('missingData')),
    check('transport-scheme', 'transport', 'transport-scheme', !transport ? 'not_applicable' : transport.https === finalUrlIsHttps ? 'pass' : 'warning', transport?.scheme || evidence('transportReportMissing')),
    check('transport-https', 'transport', 'transport-https', !transport ? 'not_applicable' : transport.https ? 'pass' : 'warning', transport ? evidence('transportScheme', { scheme: transport.https ? 'HTTPS' : 'HTTP' }) : evidence('missingData')),
    check('transport-mixed-content', 'transport', 'transport-mixed-content', !transport || transport.mixed_content_urls.length === 0 ? 'pass' : 'error', transport ? evidence('countMixed', { count: transport.mixed_content_urls.length }) : evidence('missingReport')),
    check('transport-cookies', 'transport', 'transport-cookies', !transport || transport.cookies.length === 0 ? 'not_applicable' : transport.cookies.every((cookie) => present(cookie.name)) ? 'pass' : 'warning', transport ? evidence('countCookies', { count: transport.cookies.length }) : evidence('missingData')),
    check('transport-tls-coverage', 'transport', 'transport-tls-coverage', !transport ? 'not_applicable' : present(transport.tls_coverage) ? 'pass' : 'warning', transport?.tls_coverage || evidence('missingData')),
    check('transport-cookie-names-only', 'transport', 'transport-cookie-names-only', !transport ? 'not_applicable' : 'pass', transport ? evidence('countCookieNames', { count: transport.cookies.length }) : evidence('missingData')),
  ];
};
