import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrawlResultsTabs } from "@/components/Domain/CrawlResultsTabs";
import { useProjectStore } from "@/stores/projectStore";

import * as tauriService from "@/services/tauri";
import type { CrawlRunRecord, SiteCrawlResult } from "@/types";
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

it("captures and downloads a selected rendered URL artifact", async () => {
    const renderedResult = {
      ...result,
      crawl_mode: "browser-rendered",
      pages: [
        ...result.pages,
        {
          ...result.pages[0],
          url: "https://example.com/rendered",
          final_url: "https://example.com/rendered",
          title: "Rendered page",
        },
      ],
    } as SiteCrawlResult;
    const renderedRun = {
      ...run,
      id: "rendered-run",
      result: renderedResult,
      config: { ...run.config, crawlMode: "browser-rendered" },
    } as CrawlRunRecord;
    const capture = vi
      .spyOn(tauriService, "captureRenderedArtifact")
      .mockResolvedValue({
        requestedUrl: "https://example.com/rendered",
        finalUrl: "https://example.com/rendered",
        runId: "rendered-run",
        capturedAt: "2026-09-23T12:34:56Z",
        artifactType: "screenshot",
        contentType: "image/png",
        fileName: "rendered-page-20260923T123456Z-screenshot.png",
        bytes: 4,
        dataBase64: "cG5n",
        rendererPlatform: "macos-wkwebview",
      });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:rendered-artifact"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <CrawlResultsTabs
        result={renderedResult}
        runs={[renderedRun]}
        selectedRun={renderedRun}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Performance/ }));
    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.renderedUrlForArtifact")), {
      target: { value: "https://example.com/rendered" },
    });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("crawlDeepUi.screenshot") }));

    await waitFor(() =>
      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/rendered",
          kind: "screenshot",
          runId: "rendered-run",
        }),
      ),
    );
    expect(screen.getByText(i18n.t("crawl.ui.createdAndDownloaded"))).not.toBeNull();
    expect(screen.getByText("macos-wkwebview")).not.toBeNull();
  });
});
