import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as art from "@/components/illustrations";
import { Sparkline } from "@/components/qr/Sparkline";
import { Celebration } from "@/components/qr/wizard/Celebration";
import { STEPS, Stepper } from "@/components/qr/wizard/Stepper";

describe("illustrations", () => {
  it("are decorative SVGs coloured only with tokens", () => {
    const all = [art.NoQr, art.NoCompanies, art.NoStats, art.NoPresets, art.EmptySearch, art.Locked,
      art.NotFound, art.AccessDenied, art.TrialExpired, art.Suspended, art.Onboarding, art.AuthArtwork,
      () => <art.Transfer state="pending" />, () => <art.Transfer state="declined" />]; // prettier-ignore
    for (const Art of all) {
      const { container, unmount } = render(<Art />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      const colours = [...svg.querySelectorAll("[fill],[stroke]")].flatMap((n) =>
        ["fill", "stroke"].map((a) => n.getAttribute(a)).filter(Boolean),
      );
      expect(
        colours.every((c) => c === "none" || c!.startsWith("var(--") || c!.startsWith("url(#")),
      ).toBe(true);
      unmount();
    }
  });
});

describe("wizard", () => {
  it("stepper marks progress and only allows reached steps", async () => {
    const onJump = vi.fn();
    render(<Stepper step={1} maxReached={1} onJump={onJump} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(STEPS.length);
    expect(buttons[1]).toHaveAttribute("aria-current", "step");
    expect(buttons[2]).toBeDisabled();
    await userEvent.click(buttons[0]);
    expect(onJump).toHaveBeenCalledWith(0);
  });

  it("celebration is decorative and sparkline scales to its maximum", () => {
    const { container } = render(
      <>
        <Celebration />
        <Sparkline values={[0, 1, 2, 3, 4, 5, 6]} />
      </>,
    );
    expect(container.querySelector("[aria-hidden='true'] path[pathLength='1']")).not.toBeNull();
    const points = container.querySelector("polyline")!.getAttribute("points")!.split(" ");
    expect(points).toHaveLength(7);
    expect(points[6].endsWith(",2.0")).toBe(true);
  });
});
