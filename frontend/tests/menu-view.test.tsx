import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MenuView } from "@/components/menu/MenuView";
import type { MenuBlock, PageFiles } from "@/lib/page-types";

const FILE = "0123456789abcdef0123456789abcdef";

describe("MenuView photos", () => {
  it("shows the photo of an item using the thumb variant the backend really produces", () => {
    const block = {
      id: "m",
      type: "menu",
      currency: "EUR",
      intro: { it: "", en: "" },
      sections: [
        {
          id: "s",
          kind: "food",
          title: { it: "Antipasti", en: "" },
          items: [
            {
              id: "i",
              name: { it: "Tagliere", en: "" },
              description: { it: "", en: "" },
              price: "14.00",
              photo_file_id: FILE,
              allergens: [],
              badges: [],
              sold_out: false,
              wine: null,
            },
          ],
        },
      ],
    } as unknown as MenuBlock;
    const files = {
      [FILE]: { kind: "image", name: "t.jpg", urls: { large: "/f/x/large", thumb: "/f/x/thumb" } },
    } as unknown as PageFiles;
    const { container } = render(<MenuView block={block} files={files} languages={["it"]} />);
    expect(screen.getByText("Tagliere")).toBeInTheDocument();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/f/x/thumb");
  });
});
