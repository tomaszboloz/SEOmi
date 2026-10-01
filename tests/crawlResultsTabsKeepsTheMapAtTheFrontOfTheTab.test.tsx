import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

it("keeps the map at the front of the tab strip and offers a direct section picker", () => {
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    const firstTabs = screen.getAllByRole("tab").slice(0, 2);
expect(firstTabs[0].textContent).toContain("Overview");
expect(firstTabs[1].textContent).toContain("Map & clusters");
    fireEvent.change(screen.getByLabelText("Jump to crawl section"), {
      target: { value: "customSearch" },
    });
    expect(
      screen
        .getByRole("tab", { name: /Custom search/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

it("remembers the selected result section per project and crawl-run", () => {
    useProjectStore.setState({ activeProjectId: "project-navigation" });
    const view = render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

fireEvent.click(screen.getByRole("tab", { name: /Content/ }));
    const key = "seomi_project_project-navigation_crawl_navigation_run-1_v1";
    expect(localStorage.getItem(key)).toContain('"activeTab":"content"');

    view.unmount();
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    expect(
screen.getByRole("tab", { name: /Content/ }).getAttribute("aria-selected"),
    ).toBe("true");
expect(screen.getByText(/Content & resources · Content · 1 items/)).not.toBeNull();
  });

it("persists link filters per project and crawl-run", () => {
    useProjectStore.setState({ activeProjectId: "project-links" });
    const view = render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Links/ }));
    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.searchLink")), { target: { value: "missing" } });
    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.linkType")), { target: { value: "internal" } });
    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.linkStatus")), { target: { value: "error" } });
    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.linkSort")), { target: { value: "target" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("crawl.ui.ascending") }));
    expect(localStorage.getItem("seomi_project_project-links_crawl_links_run-1_v1")).toContain('"status":"error"');

    view.unmount();
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Links/ }));
    expect(screen.getByLabelText(i18n.t("crawl.ui.searchLink"))).toHaveProperty("value", "missing");
    expect(screen.getByLabelText(i18n.t("crawl.ui.linkType"))).toHaveProperty("value", "internal");
    expect(screen.getByLabelText(i18n.t("crawl.ui.linkStatus"))).toHaveProperty("value", "error");
    expect(screen.getByLabelText(i18n.t("crawl.ui.linkSort"))).toHaveProperty("value", "target");
    expect(screen.getByRole("button", { name: i18n.t("crawl.ui.descending") }).getAttribute("aria-pressed")).toBe("true");
  });

it("opens a link deep-link on the Links tab and highlights the exact source/target row", async () => {
    const projectId = "project-link-evidence";
    const source = "https://example.com/";
    const target = "https://example.com/missing";
    useProjectStore.setState({ activeProjectId: projectId });
    window.location.hash = `#crawl-evidence?project=${encodeURIComponent(projectId)}&run=${encodeURIComponent(run.id)}&url=${encodeURIComponent(source)}&tab=links&source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`;

    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Links/ }).getAttribute("aria-selected")).toBe("true");
    });
    const sourceLink = screen.getByRole("link", { name: source });
    expect(sourceLink.getAttribute("href")).toContain("tab=links");
    expect(sourceLink.getAttribute("href")).toContain(encodeURIComponent(target));
    expect(sourceLink.closest("tr")?.getAttribute("data-target-url")).toBe(target);
    expect(sourceLink.closest("tr")?.className).toContain("bg-emerald-500/10");
  });
});
