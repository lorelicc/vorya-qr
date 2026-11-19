import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StaticNotice } from "@/components/qr/StaticNotice";

describe("StaticNotice", () => {
  it("keeps a polite live region mounted and states the consequence in text", () => {
    const { rerender } = render(<StaticNotice show={false} />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByTestId("static-notice")).toBeNull();
    rerender(<StaticNotice show />);
    expect(screen.getByTestId("static-notice")).toHaveTextContent(
      "Questo QR è statico: il contenuto viene scritto direttamente nel codice.",
    );
    expect(screen.getByTestId("static-notice")).toHaveTextContent(
      "NON potrà più essere modificato",
    );
    expect(screen.getByTestId("static-notice")).toHaveTextContent(
      "non potrai vederne le statistiche",
    );
  });

  it("offers the dynamic version only when an equivalent exists", async () => {
    const onUseDynamic = vi.fn();
    const { rerender } = render(<StaticNotice show onUseDynamic={onUseDynamic} />);
    await userEvent.click(screen.getByRole("button", { name: "Usa la versione dinamica" }));
    expect(onUseDynamic).toHaveBeenCalledOnce();
    rerender(<StaticNotice show />);
    expect(screen.queryByRole("button", { name: "Usa la versione dinamica" })).toBeNull();
  });
});
