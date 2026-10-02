import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OverviewContentAnalysis } from "@/components/Results/overview/OverviewContentAnalysis";
import { OverviewCoverageSection } from "@/components/Results/overview/OverviewCoverageSection";
import { OverviewDataForSeoBar } from "@/components/Results/overview/OverviewDataForSeoBar";
import {
  accessibilitySelectorForCode,
  accessibilityEvidenceLabelKey,
} from "@/components/Results/overview/overviewTypes";
import type { PageAuditData } from "@/types";

const mockAudit: PageAuditData = {
  url: "https://example.com",
  final_url: "https://example.com/final",
  timestamp: "2026-09-24T00:00:00.000Z",
  http_status: 200,
  response_time_ms: 150,
  redirect_chain: [{ url: "https://example.com", status_code: 301 }],
  meta_tags: {
    title: "Test Title",
    title_length: 10,
    description: "Test Description",
    description_length: 16,
    other_tags: [],
  },
  open_graph: { all_tags: [] },
  twitter_card: { all_tags: [] },
  headings: {
    h1_count: 1,
    h1_texts: ["Main"],
    hierarchy: [],
    has_valid_hierarchy: true,
    issues: [],
  },
  images: [],
  links: {
    total_links: 5,
    internal_links: 3,
    external_links: 2,
    nofollow_links: 0,
    links: [],
  },
  security_headers: { score: 95 },
  structured_data: [],
  technical: { server: "nginx/1.24", hreflang_tags: [] },
  health_score: 92,
  issues: [],
  content_stats: {
    word_count: 350,
    reading_time_minutes: 2,
    text_ratio_percent: 18.5,
    sentence_count: 25,
    average_words_per_sentence: 14,
    average_characters_per_word: 5.2,
    complexity_score: 45,
    complexity_label: "moderate",
    readability_ease_score: 72,
    readability_grade: 8.1,
    readability_label: "Standard",
    top_keywords: [{ keyword: "seo", count: 8, density_percent: 2.3 }],
  },
};

describe("Overview analysis and coverage components", () => {
  it("renders OverviewContentAnalysis with full and empty metrics", () => {
    const { rerender } = render(
      <OverviewContentAnalysis audit={mockAudit} />,
    );
    expect(screen.getByText("25")).toBeDefined();
    expect(screen.getByText("seo")).toBeDefined();

    const emptyAudit = {
      ...mockAudit,
      content_stats: {
        ...mockAudit.content_stats,
        word_count: 0,
      },
    };
    rerender(<OverviewContentAnalysis audit={emptyAudit} />);
    expect(screen.queryByText("seo")).toBeNull();
  });

  it("renders OverviewCoverageSection and interacts with filters and pagination", () => {
    render(<OverviewCoverageSection audit={mockAudit} />);
    const copyBtn = screen.getByRole("button", { name: /copy/i });
    expect(copyBtn).toBeDefined();

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: "headings" } });
  });

  it("renders OverviewDataForSeoBar with fallbacks and domain", () => {
    render(<OverviewDataForSeoBar audit={mockAudit} />);
    expect(screen.getByText(/Connect DataForSEO/i)).toBeDefined();
  });

  it("verifies accessibility helpers for selector and label keys", () => {
    expect(
      accessibilitySelectorForCode("accessibility-interactive-name-missing"),
    ).toContain("a[href]");
    expect(
      accessibilitySelectorForCode("accessibility-image-alt-missing"),
    ).toBe("img:not([alt])");
    expect(
      accessibilitySelectorForCode("accessibility-duplicate-id"),
    ).toBe("[id]");
    expect(accessibilitySelectorForCode("unknown-code")).toBe(
      "input, select, textarea",
    );

    expect(
      accessibilityEvidenceLabelKey("accessibility-image-alt-missing"),
    ).toBe("accessibility.image");
    expect(
      accessibilityEvidenceLabelKey("accessibility-duplicate-id"),
    ).toBe("accessibility.duplicateId");
    expect(accessibilityEvidenceLabelKey("unknown-code")).toBe(
      "accessibility.formControl",
    );
  });
});
