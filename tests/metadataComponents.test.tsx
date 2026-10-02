import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetadataSpotlight } from '../src/components/Results/metadata/MetadataSpotlight';
import { MetadataDirectives } from '../src/components/Results/metadata/MetadataDirectives';
import { MetadataTechnologies } from '../src/components/Results/metadata/MetadataTechnologies';
import { MetadataFavicons } from '../src/components/Results/metadata/MetadataFavicons';
import { MetadataHreflang } from '../src/components/Results/metadata/MetadataHreflang';
import { MetadataOtherTags } from '../src/components/Results/metadata/MetadataOtherTags';
import { PageAuditData } from '../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => vi.fn(),
}));
vi.mock('@/services/clipboard', () => ({
  copyText: vi.fn(),
}));

const mockAudit: Partial<PageAuditData> = {
  meta_tags: {
    title: 'Test Title',
    title_length: 10,
    description: 'Test Description',
    description_length: 16,
    canonical: 'https://test.com',
    robots: 'index, follow',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'utf-8',
    keywords: 'test, keywords',
    theme_color: '#ffffff',
    generator: 'Next.js',
    author: 'Test Author',
    other_tags: [{ name: 'test-tag', content: 'test-content' }],
  },
  technical: {
    technology_signals: [{ category: 'CMS', name: 'WordPress', confidence: 'confirmed', evidence: 'wp-content' }],
    favicons: [{ href: '/favicon.ico', rel: 'icon', declared_type: 'image/x-icon', declared_sizes: '16x16' }],
    hreflang_tags: [{ href: 'https://test.com/es', hreflang: 'es' }],
  },
  indexability: { status: 'indexable', reasons: [] },
  accessibility: {} as any,
};

describe('Metadata Subcomponents', () => {
  it('MetadataSpotlight renders title and description', () => {
    render(<MetadataSpotlight audit={mockAudit as PageAuditData} />);
    expect(screen.getByText('Test Title')).toBeDefined();
    expect(screen.getByText('Test Description')).toBeDefined();
    expect(screen.getByText('metadata.metaTableTitle')).toBeDefined();
  });

  it('MetadataDirectives renders standard tags', () => {
    render(<MetadataDirectives audit={mockAudit as PageAuditData} />);
    expect(screen.getByText('https://test.com')).toBeDefined();
    expect(screen.getByText('index, follow')).toBeDefined();
    expect(screen.getByText('width=device-width, initial-scale=1')).toBeDefined();
  });

  it('MetadataTechnologies renders technology signals', () => {
    render(<MetadataTechnologies audit={mockAudit as PageAuditData} />);
    expect(screen.getByText('WordPress')).toBeDefined();
    expect(screen.getByText('wp-content')).toBeDefined();
  });

  it('MetadataFavicons renders favicon list', () => {
    render(<MetadataFavicons audit={mockAudit as PageAuditData} />);
    expect(screen.getByText('/favicon.ico')).toBeDefined();
    expect(screen.getByText('icon')).toBeDefined();
  });

  it('MetadataHreflang renders hreflang tags', () => {
    render(<MetadataHreflang audit={mockAudit as PageAuditData} />);
    expect(screen.getByText('https://test.com/es')).toBeDefined();
    expect(screen.getByText('es')).toBeDefined();
  });

  it('MetadataOtherTags renders other tags', () => {
    render(<MetadataOtherTags audit={mockAudit as PageAuditData} />);
    expect(screen.getByText('name="test-tag"')).toBeDefined();
    expect(screen.getByText('test-content')).toBeDefined();
  });
});
