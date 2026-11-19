import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { RulesTimeline } from "@/components/links/RulesTimeline";
import { UtmBuilder } from "@/components/links/UtmBuilder";
import { existingUtm, utmConflicts, withUtm, EMPTY_UTM } from "@/lib/utm";

vi.mock("@/lib/company-context", () => ({
  useCompany: () => ({ api: "companies/1", app: "/app/c/1", company: { id: 1 } }),
}));
vi.mock("@/lib/api", () => ({
  api: vi.fn().mockResolvedValue([]),
  errorMessage: (e: unknown) => String(e),
}));

describe("utm helpers", () => {
  it("appends only filled fields and keeps the rest of the URL", () => {
    expect(withUtm("https://e.com/p?x=1", { ...EMPTY_UTM, source: "news", medium: "email" })).toBe(
      "https://e.com/p?x=1&utm_source=news&utm_medium=email",
    );
    expect(withUtm("non un url", EMPTY_UTM)).toBeNull();
  });

  it("detects parameters already in the URL", () => {
    expect(existingUtm("https://e.com/?utm_source=a&utm_term=b")).toEqual(["source", "term"]);
    expect(
      utmConflicts("https://e.com/?utm_source=a", { ...EMPTY_UTM, source: "x", medium: "y" }),
    ).toEqual(["source"]);
  });
});

describe("UtmBuilder", () => {
  it("previews the final URL and blocks duplicates", async () => {
    const onApply = vi.fn();
    render(
      <ToastProvider>
        <UtmBuilder url="https://e.com/?utm_source=old" onApply={onApply} canTemplate={false} />
      </ToastProvider>,
    );
    await userEvent.type(screen.getByLabelText(/Medium/), "email");
    expect(screen.getByText(/utm_medium=email/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Source/), "new");
    expect(screen.getByText("utm_source è già nell'URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usa questo URL" })).toBeDisabled();
  });
});

describe("RulesTimeline", () => {
  it("lists the current destination, rules in order and the expiry", () => {
    const now = new Date("2026-06-15T12:00:00Z").getTime();
    render(
      <RulesTimeline
        now={now}
        base="https://e.com/base"
        entries={[
          { at: new Date("2026-07-01T00:00:00Z"), url: "https://e.com/estate" },
          { at: new Date("2026-06-01T00:00:00Z"), url: "https://e.com/giugno" },
        ]}
        expires={new Date("2026-09-01T00:00:00Z")}
      />,
    );
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("Ora");
    expect(items[1]).toContain("https://e.com/giugno");
    expect(items[2]).toContain("https://e.com/estate");
    expect(items[3]).toContain("Il link scade");
  });
});
