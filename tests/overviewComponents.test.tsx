import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { OverviewScoreGauge } from "@/components/Results/overview/OverviewScoreGauge";
import { OverviewIssuesSummary } from "@/components/Results/overview/OverviewIssuesSummary";
import { OverviewServerCard } from "@/components/Results/overview/OverviewServerCard";
import { OverviewContentCard } from "@/components/Results/overview/OverviewContentCard";
import { OverviewQuickWins } from "@/components/Results/overview/OverviewQuickWins";
import { OverviewIssuesList } from "@/components/Results/overview/OverviewIssuesList";
import { OverviewExportBar } from "@/components/Results/overview/OverviewExportBar";
import type { PageAuditData } from "@/types";

const overviewExports = vi.hoisted(() => ({
  downloadAuditJson: vi.fn(), downloadAuditCsv: vi.fn(), downloadAuditHtml: vi.fn(), downloadAuditPdf: vi.fn(),
}));
vi.mock("@/services/export", () => overviewExports);

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
  issues: [
    { severity: "Critical", category: "MetaTags", code: "meta_title_missing", message: "Missing meta title", recommendation: "Provide title" },
    { severity: "Warning", category: "Images", code: "image_alt_missing", message: "Image without alt" },
    { severity: "Info", category: "Links", code: "link_count_low", message: "Few links" },
  ],
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

describe("Overview subcomponents", () => {
  it("renders OverviewScoreGauge correctly with high health score", () => {
    render(<OverviewScoreGauge audit={mockAudit} criticalCount={1} />);
    expect(screen.getByText("92")).toBeDefined();
    expect(screen.getByText("/ 100")).toBeDefined();
  });

  it("renders OverviewScoreGauge for lower scores", () => {
    const lowAudit = { ...mockAudit, health_score: 55 };
    render(<OverviewScoreGauge audit={lowAudit} criticalCount={2} />);
    expect(screen.getByText("55")).toBeDefined();
  });

  it("renders OverviewIssuesSummary with counts", () => {
    render(
      <OverviewIssuesSummary
        criticalIssues={[mockAudit.issues[0]]}
        warnings={[mockAudit.issues[1], mockAudit.issues[1]]}
        infoIssues={[
          mockAudit.issues[2],
          mockAudit.issues[2],
          mockAudit.issues[2],
        ]}
        totalIssuesCount={6}
      />,
    );
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("renders OverviewServerCard with response time, http status and server", () => {
    render(<OverviewServerCard audit={mockAudit} />);
    expect(screen.getByText("150")).toBeDefined();
    expect(screen.getByText("nginx/1.24")).toBeDefined();
  });

  it("renders OverviewContentCard with word count and stats", () => {
    render(<OverviewContentCard audit={mockAudit} />);
    expect(screen.getByText("350")).toBeDefined();
    expect(screen.getByText("18.5%")).toBeDefined();
  });

  it("renders OverviewQuickWins when issues exist and hides when empty", () => {
    const { rerender } = render(<OverviewQuickWins issuesCount={3} />);
    expect(screen.getByRole("button")).toBeDefined();

    rerender(<OverviewQuickWins issuesCount={0} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders OverviewIssuesList with items and empty state", () => {
    const { rerender } = render(<OverviewIssuesList audit={mockAudit} />);
    expect(screen.getByText("Missing page <title> tag")).toBeDefined();
    expect(screen.getByText(/Provide an informative title/)).toBeDefined();

    const cleanAudit = { ...mockAudit, issues: [] };
    rerender(<OverviewIssuesList audit={cleanAudit} />);
    expect(screen.queryByText("Missing page <title> tag")).toBeNull();
  });

  it("renders OverviewExportBar buttons", () => {
    render(<OverviewExportBar audit={mockAudit} />);
    const buttons = ["exportJson", "exportCsv", "exportHtml", "exportPdf"].map((key) =>
      screen.getByRole("button", { name: i18n.t(`overview.${key}`) }));
    expect(buttons).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("overview.exportHtml") }));
    expect(overviewExports.downloadAuditHtml).toHaveBeenCalledWith(mockAudit);
    expect(overviewExports.downloadAuditJson).not.toHaveBeenCalled();
    expect(overviewExports.downloadAuditCsv).not.toHaveBeenCalled();
    expect(overviewExports.downloadAuditPdf).not.toHaveBeenCalled();
  });
});
