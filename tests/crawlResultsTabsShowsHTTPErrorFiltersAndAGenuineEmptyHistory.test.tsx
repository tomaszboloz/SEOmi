import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrawlResultsTabs } from "@/components/Domain/CrawlResultsTabs";
import { useProjectStore } from "@/stores/projectStore";

import i18n from "@/i18n";
import { result, run } from "./fixtures/crawlResultsTabsContracts";

describe("CrawlResultsTabs", () => {
afterEach(async () => {
    await i18n.changeLanguage('en');
  });

beforeEach(async () => {
    await i18n.changeLanguage('en');
   localStorage.clear();
    window.history.replaceState(null, "", "/");
    useProjectStore.setState({ activeProjectId: null });
  });

it("shows HTTP error filters and a genuine empty-history state", () => {
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /URL/ }));
    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.errorType")), {
      target: { value: "http" },
    });
    const pageUrlCells = screen
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
    expect(pageUrlCells).toContain("https://example.com/missing");
    expect(pageUrlCells).not.toContain("https://example.com/");

fireEvent.click(screen.getByRole("tab", { name: /Map & clusters/ }));
    expect(screen.getByRole("img", { name: i18n.t("mapUi.svgAria") })).not.toBeNull();
  });

it("segments and searches URLs, and persists named filter presets per project", () => {
    useProjectStore.setState({ activeProjectId: "project-a" });
    const view = render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /URL/ }));

    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.httpSegment")), {
      target: { value: "4xx" },
    });
    expect(
      screen.getAllByRole("cell").map((cell) => cell.textContent),
    ).toContain("https://example.com/missing");
    expect(
      screen.getAllByRole("cell").map((cell) => cell.textContent),
    ).not.toContain("https://example.com/");

    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.httpSegment")), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.searchUrlTitle")), {
      target: { value: "Example home" },
    });
    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.savedFilterName")), {
      target: { value: "Strona główna" },
    });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("crawl.ui.saveFilter") }));
    expect(
      localStorage.getItem("seomi_project_project-a_crawl_filter_presets_v1"),
    ).toContain("Strona główna");

    view.unmount();
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /URL/ }));
    expect(
      screen.getByRole("option", { name: "Strona główna" }),
    ).not.toBeNull();
    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.searchUrlTitle")), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.savedProjectFilters")), {
      target: {
        value: screen
          .getByRole("option", { name: "Strona główna" })
          .getAttribute("value"),
      },
    });
    expect(
      screen.getAllByRole("cell").map((cell) => cell.textContent),
    ).toContain("https://example.com/");
    expect(
      screen.getAllByRole("cell").map((cell) => cell.textContent),
    ).not.toContain("https://example.com/missing");
  });
});
