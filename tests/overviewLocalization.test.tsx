import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@/components/Results/Overview';
import '@/components/Results/AuditTabs';
import { MainContent } from '@/components/Layout/MainContent';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';
import type { PageAuditData } from '@/types';

const audit: PageAuditData = {
  url: 'https://example.com',
  final_url: 'https://example.com',
  timestamp: '2026-09-24T00:00:00.000Z',
  http_status: 200,
  response_time_ms: 120,
  redirect_chain: [],
  meta_tags: { title: 'Example', title_length: 7, description: 'Example page', description_length: 12, other_tags: [] },
  open_graph: { all_tags: [] },
  twitter_card: { all_tags: [] },
  headings: { h1_count: 1, h1_texts: ['Example'], hierarchy: [{ level: 1, text: 'Example', children: [] }], has_valid_hierarchy: true, issues: [] },
  images: [],
  links: { total_links: 0, internal_links: 0, external_links: 0, nofollow_links: 0, links: [] },
  security_headers: { score: 90 },
  structured_data: [],
  technical: { hreflang_tags: [] },
  health_score: 70,
  issues: [{
    severity: 'Critical',
    category: 'MetaTags',
    code: 'meta_description_missing',
    message: 'Missing meta description tag',
    recommendation: 'Add a compelling meta description between 120-160 characters',
  }],
  content_stats: { word_count: 20, reading_time_minutes: 1, text_ratio_percent: 10, top_keywords: [] },
};

describe('overview localization', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pl');
    useProjectStore.setState({
      projects: [{ id: 'overview-locale-project', name: 'Projekt', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' }],
      activeProjectId: 'overview-locale-project',
    });
    useAuditStore.setState({ currentAudit: audit, activeTab: 'overview', isLoading: false, error: null, showOnlyProblems: false });
  });

  afterEach(async () => {
    await act(async () => { await i18n.changeLanguage('en'); });
  });

  it('renders the localized severity instead of an unresolved translation key', async () => {
    await act(async () => { render(<MainContent />); });

    await waitFor(() => expect(screen.getAllByText('Krytyczne').length).toBeGreaterThan(0));
    expect(screen.queryByText('PROJECTS.VALIDATION.SEVERITYVALUES.CRITICAL')).toBeNull();
    expect(screen.getAllByText('Meta i indeksacja').length).toBeGreaterThan(0);
    expect(screen.queryByText('[MetaTags]')).toBeNull();
  });

  it('renders localized backend issue text and recommendation by stable code', async () => {
    await act(async () => { render(<MainContent />); });

    await waitFor(() => {
      expect(screen.getByText('Brak tagu meta description')).toBeTruthy();
      expect(screen.getByText(/Dodaj przekonujący meta description/)).toBeTruthy();
    });
    expect(screen.queryByText('Missing meta description tag')).toBeNull();
  });

  it('exposes accessibility issue locations directly in the overview', async () => {
    const accessibilityAudit = {
      ...audit,
      issues: [{
        severity: 'Warning' as const,
        category: 'Technical' as const,
        code: 'accessibility-form-controls-unlabeled',
        params: { unlabeled: '1', total: '2' },
        message: '1 z 2 kontrolek formularza nie ma wykrytej etykiety programowej.',
        recommendation: 'Powiąż każde pole z etykietą.',
      }],
      accessibility: {
        document_language: 'pl',
        landmarks: [],
        aria_attribute_count: 0,
        form_control_count: 2,
        unlabeled_form_control_count: 1,
        findings: [{
          code: 'accessibility-form-controls-unlabeled',
          severity: 'warning',
          message: '1 z 2 kontrolek formularza nie ma wykrytej etykiety programowej.',
          evidence: 'Nieopisane pola: 1/2',
          recommendation: 'Powiąż każde pole z etykietą.',
          elements: [{
            dom_position: 2,
            dom_query: "document.querySelectorAll('input, select, textarea')[1]",
            html_snippet: '<input type="email" name="contact">',
            line: 12,
            column: 5,
          }],
        }],
        manual_review_items: [],
      },
    };
    useAuditStore.setState({ currentAudit: accessibilityAudit, activeTab: 'overview', isLoading: false, error: null, showOnlyProblems: false });
    await act(async () => { render(<MainContent />); });

    await waitFor(() => expect(screen.getByText('Lokalizacje problemu (1)')).toBeTruthy());
    expect(screen.getByText("document.querySelectorAll('input, select, textarea')[1]")).toBeTruthy();
    expect(screen.getByText('<input type="email" name="contact">')).toBeTruthy();
    expect(screen.getByText(/źródło 12:5/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pokaż na stronie: kontrolka formularza #2' })).toBeTruthy();
  });
});
