import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SidebarNewProjectButton } from "@/components/Layout/sidebar/SidebarNewProjectButton";
import { SidebarProjectCard } from "@/components/Layout/sidebar/SidebarProjectCard";
import { SidebarNavItem } from "@/components/Layout/sidebar/SidebarNavItem";
import { SidebarAiCard } from "@/components/Layout/sidebar/SidebarAiCard";
import { SidebarCollapseButton } from "@/components/Layout/sidebar/SidebarCollapseButton";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";

// Mock the dependencies
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
  };
});

vi.mock("@/stores/uiStore", () => ({
  useUIStore: vi.fn(),
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: vi.fn(),
}));

describe("Sidebar Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SidebarNewProjectButton renders and calls openModal", () => {
    const mockOpenModal = vi.fn();
    (useUIStore as any).mockImplementation((selector: any) => {
      const state = { openModal: mockOpenModal };
      return selector ? selector(state) : state;
    });

    render(<SidebarNewProjectButton sidebarCollapsed={false} />);
    const btn = screen.getByRole("button", { name: "sidebar.newProject" });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(mockOpenModal).toHaveBeenCalledWith("create-project");
  });

  it("SidebarProjectCard shows project name", () => {
    render(
      <SidebarProjectCard
        sidebarCollapsed={false}
        activeProject={{ id: "1", name: "Test Project", rootUrl: "https://test.com" }}
      />
    );
    expect(screen.getByText("Test Project")).toBeTruthy();
    expect(screen.getByText("https://test.com")).toBeTruthy();
  });

  it("SidebarNavItem renders active/inactive states", () => {
    const mockSetActiveTab = vi.fn();
    const item = {
      id: "overview" as const,
      labelKey: "test.label",
      keywords: "test",
      icon: () => <svg data-testid="icon" />,
    };

    const { rerender } = render(
      <SidebarNavItem
        item={item}
        itemIndex={0}
        sidebarCollapsed={false}
        activeTab="metadata"
        setActiveTab={mockSetActiveTab}
      />
    );
    
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-current")).toBeNull();

    rerender(
      <SidebarNavItem
        item={item}
        itemIndex={0}
        sidebarCollapsed={false}
        activeTab="overview"
        setActiveTab={mockSetActiveTab}
      />
    );

    expect(screen.getByRole("button").getAttribute("aria-current")).toBe("page");
  });

  it("SidebarAiCard shows connected/disconnected states", () => {
    const mockOpenModal = vi.fn();
    (useUIStore as any).mockImplementation((selector: any) => {
      const state = { openModal: mockOpenModal };
      return selector ? selector(state) : state;
    });

    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { provider: "openai", connectionStatus: { openai: "connected" } };
      return selector ? selector(state) : state;
    });
    
    const { rerender } = render(<SidebarAiCard />);
    expect(screen.getByText("OpenAI sidebar.connected")).toBeTruthy();
    
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { provider: "openai", connectionStatus: { openai: "unconfigured" } };
      return selector ? selector(state) : state;
    });
    
    rerender(<SidebarAiCard />);
    expect(screen.getByText("sidebar.aiConnectionPrompt")).toBeTruthy();
  });

  it("SidebarCollapseButton toggles", () => {
    const mockToggle = vi.fn();
    render(
      <SidebarCollapseButton sidebarCollapsed={false} toggleSidebar={mockToggle} />
    );
    
    const btn = screen.getByRole("button", { name: "sidebar.collapseMenu" });
    fireEvent.click(btn);
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});
