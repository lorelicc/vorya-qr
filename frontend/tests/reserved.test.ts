import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTE_WORDS, isRootShortLink } from "@/lib/reserved";

function firstSegments(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      d.name.startsWith("(")
        ? firstSegments(path.join(dir, d.name))
        : d.name.startsWith("[")
          ? []
          : [d.name],
    );
}

describe("root short links", () => {
  it("never capture an app route", () => {
    const missing = firstSegments(path.resolve(__dirname, "../app")).filter(
      (name) => !ROUTE_WORDS.has(name),
    );
    expect(missing).toEqual([]);
  });

  it("accept slugs and back-halves only", () => {
    expect(isRootShortLink("Ab3dEf7")).toBe(true);
    expect(isRootShortLink("vendemmia-2026")).toBe(true);
    expect(isRootShortLink("login")).toBe(false);
    expect(isRootShortLink("favicon.ico")).toBe(false);
    expect(isRootShortLink("-x-")).toBe(false);
    expect(isRootShortLink("ab")).toBe(false);
  });
});
