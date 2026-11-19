import { describe, expect, it } from "vitest";
import { backendPath, isAllowed } from "@/lib/allowlist";
import { contrastRatio, qrWarnings } from "@/lib/contrast";
import { daysLeft, limitLabel, scansLabel } from "@/lib/format";

describe("contrast", () => {
  it("matches the backend rules", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(qrWarnings("#091411", "#ffffff", 4)).toEqual([]);
    expect(qrWarnings("#eeeeee", "#ffffff", 1).map((w) => w.code)).toEqual([
      "low_contrast",
      "small_margin",
    ]);
    expect(qrWarnings("#ffffff", "#091411", 4).map((w) => w.code)).toEqual(["inverted"]);
    expect(qrWarnings("#zzz", "#ffffff", 4)).toEqual([]);
  });
});

describe("format", () => {
  it("always speaks of scans, never of visitors", () => {
    expect(scansLabel(1)).toBe("1 scansione");
    expect(scansLabel(12000)).toBe("12.000 scansioni");
    expect(limitLabel(null)).toBe("illimitati");
  });

  it("counts remaining trial days", () => {
    const now = Date.parse("2026-11-19T10:00:00Z");
    expect(daysLeft("2026-12-03T10:00:00Z", now)).toBe(14);
    expect(daysLeft("2026-11-01T10:00:00Z", now)).toBe(0);
    expect(daysLeft(null, now)).toBe(0);
  });
});

describe("proxy allowlist", () => {
  it("allows only known routes and methods", () => {
    expect(isAllowed("companies", "GET")).toBe(true);
    expect(isAllowed("companies/3/qr-codes", "GET")).toBe(true);
    expect(isAllowed("companies/3/qr-codes/12/pause", "POST")).toBe(true);
    expect(isAllowed("companies/3/qr-codes/12/image.png", "GET")).toBe(true);
    expect(isAllowed("company-transfers/5/accept", "POST")).toBe(true);
    expect(isAllowed("admin/workspaces/3/plan", "PUT")).toBe(true);
    expect(isAllowed("qr-codes", "GET")).toBe(false); // 0.1 endpoints removed
    expect(isAllowed("companies/3/qr-codes/12/pause", "GET")).toBe(false);
    expect(isAllowed("companies/abc", "GET")).toBe(false);
    expect(isAllowed("openapi.json", "GET")).toBe(false);
    expect(isAllowed("admin/plans", "DELETE")).toBe(false);
  });

  it("maps health outside /api", () => {
    expect(backendPath("health")).toBe("/health");
    expect(backendPath("qr-codes")).toBe("/api/qr-codes");
  });
});
