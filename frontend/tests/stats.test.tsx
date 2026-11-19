import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LineChart } from "@/components/stats/LineChart";
import { RangePicker, rangeQuery } from "@/components/stats/RangePicker";
import { countryName } from "@/components/stats/StatsDashboard";

const days = [
  { date: "2026-11-01", count: 4, unique: 3, clicks: 1 },
  { date: "2026-11-02", count: 0, unique: 0, clicks: 0 },
  { date: "2026-11-03", count: 9, unique: 5, clicks: 2 },
];

describe("statistics", () => {
  it("draws one path per series and exposes the values as a table", () => {
    const { container } = render(
      <LineChart
        days={days}
        series={[
          { key: "count", label: "Scansioni", tone: "main" },
          { key: "unique", label: "Unici", tone: "soft" },
        ]}
      />,
    );
    expect(container.querySelectorAll("path[pathLength='1']")).toHaveLength(2);
    expect(screen.getByRole("table", { hidden: true })).toHaveTextContent("9");
  });

  it("builds range queries and switches presets", async () => {
    expect(rangeQuery({ range: "7d" })).toBe("range=7d");
    expect(rangeQuery({ range: "custom", start: "2026-01-01", end: "2026-01-31" })).toBe(
      "range=custom&start=2026-01-01&end=2026-01-31",
    );
    const onChange = vi.fn();
    render(<RangePicker value={{ range: "30d" }} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "7 giorni" }));
    expect(onChange).toHaveBeenCalledWith({ range: "7d" });
    await userEvent.click(screen.getByRole("radio", { name: "Personalizzato" }));
    expect(screen.getByLabelText("Dal")).toBeInTheDocument();
  });

  it("names countries in Italian", () => {
    expect(countryName("IT")).toBe("Italia");
    expect(countryName(null)).toBe("Altro");
  });
});
