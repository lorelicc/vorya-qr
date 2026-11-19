import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImportPreview } from "@/components/import/ImportPreview";
import type { ImportJob } from "@/components/import/ImportWizard";

const base: ImportJob = {
  id: 1,
  status: "invalid",
  format: "png",
  total: 2,
  processed: 0,
  created: 0,
  error: null,
  has_result: false,
  errors: [{ row: 3, column: "destinazione", message: "Inserisci un URL completo" }],
  preview: [
    { row: 2, cells: { name: "Buona", type: "url", destination: "https://example.com" } },
    { row: 3, cells: { name: "Rotta", type: "url", destination: "non-un-url" } },
  ],
};

describe("ImportPreview", () => {
  it("highlights the failing cell and lists the error in text", () => {
    render(<ImportPreview job={base} busy={false} onConfirm={() => {}} onRestart={() => {}} />);
    const cell = screen.getByText("non-un-url").closest("td")!;
    expect(cell).toHaveAttribute("data-error");
    expect(cell).toHaveTextContent("errore: Inserisci un URL completo");
    expect(screen.getByText("https://example.com").closest("td")).not.toHaveAttribute("data-error");
    expect(screen.getByText("1 problema da correggere")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Conferma e crea/ })).toBeNull();
  });

  it("offers confirmation only when the whole file is valid", () => {
    render(
      <ImportPreview
        job={{ ...base, status: "validated", errors: [] }}
        busy={false}
        onConfirm={() => {}}
        onRestart={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Conferma e crea 2 elementi" })).toBeEnabled();
  });
});
