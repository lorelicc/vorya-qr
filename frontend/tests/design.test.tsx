import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MODULE_OPTIONS, ShapePicker } from "@/components/qr/design/ShapePicker";
import { DEFAULT_DESIGN, designForCompany, designOf } from "@/lib/design";
import type { QrCode } from "@/lib/types";

describe("design defaults", () => {
  it("starts from the company color unless it is too light", () => {
    expect(
      designForCompany({ primary_color: "#087f5b", secondary_color: "#00e99a" }).fill.color,
    ).toBe("#087f5b");
    expect(
      designForCompany({ primary_color: "#00e99a", secondary_color: "#ffffff" }).fill.color,
    ).toBe("#091411");
  });

  it("derives a design for 0.1 QR codes", () => {
    const legacy = {
      design: null,
      fg_color: "#123456",
      bg_color: "#fafafa",
      margin: 2,
      error_correction: "Q",
    } as unknown as QrCode;
    expect(designOf(legacy)).toMatchObject({
      fill: { color: "#123456" },
      background: "#fafafa",
      margin: 2,
      error_correction: "Q",
      modules: DEFAULT_DESIGN.modules,
    });
  });
});

describe("ShapePicker", () => {
  it("is a labelled radio group", async () => {
    const onChange = vi.fn();
    render(
      <ShapePicker label="Moduli" value="square" options={MODULE_OPTIONS} onChange={onChange} />,
    );
    expect(screen.getByRole("group", { name: "Moduli" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Quadrati" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Pallini" }));
    expect(onChange).toHaveBeenCalledWith("dots");
  });
});
