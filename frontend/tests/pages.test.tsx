import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageRenderer } from "@/components/page/PageRenderer";
import { cleanPage, defaultPage } from "@/components/qr/pages/defaults";
import { StaticForm } from "@/components/qr/types/StaticForm";
import { TypePicker } from "@/components/qr/types/TypePicker";
import { Markdown } from "@/lib/markdown";
import type { PageDoc } from "@/lib/page-types";

const company = { name: "Pizzeria", primary_color: "#123456", secondary_color: "#00e99a" };

describe("Markdown", () => {
  it("renders bold, italic and safe links but never HTML", () => {
    const { container } = render(
      <Markdown
        source={
          "<img src=x onerror=alert(1)> **forte** *co* [sito](https://a.it) [js](javascript:alert(1))"
        }
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("strong")).toHaveTextContent("forte");
    expect(container.querySelector("em")).toHaveTextContent("co");
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://a.it");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer nofollow");
    expect(container.textContent).toContain("<img src=x");
  });

  it("splits paragraphs and lines", () => {
    const { container } = render(<Markdown source={"uno\ndue\n\ntre"} />);
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelectorAll("br")).toHaveLength(1);
  });
});

describe("page defaults", () => {
  it("uses the company branding and the template blocks", () => {
    const page = defaultPage("vcard", company);
    expect(page.theme.primary).toBe("#123456");
    expect(page.blocks.map((b) => b.type)).toEqual(["header", "contact", "social_icons"]);
  });

  it("cleanPage drops empty optional rows and blocks", () => {
    const page = defaultPage("business", company);
    const cleaned = cleanPage(page);
    expect(cleaned.blocks.map((b) => b.type)).toEqual(["header", "opening_hours"]);
    const links = cleanPage(defaultPage("link_in_bio", company));
    const list = links.blocks.find((b) => b.type === "link_list");
    expect(list && list.type === "link_list" && list.items).toEqual([]);
  });
});

describe("PageRenderer", () => {
  const page: PageDoc = {
    ...defaultPage("vcard", company),
    blocks: [
      { id: "h", type: "header", title: "Giulia", subtitle: "Sala", cover_file_id: null, avatar_file_id: null },
      {
        id: "c", type: "contact", first_name: "Giulia", last_name: "B", organization: "", job_title: "",
        phones: [{ label: "cell", number: "+39 333 1" }], emails: [], website: "", note: "",
        address: { street: "", city: "", postal_code: "", region: "", country: "" }, save_button_label: "Salva",
      },
    ],
  }; // prettier-ignore

  it("renders blocks, the vcf link and the branding footer", () => {
    render(<PageRenderer page={page} files={{}} slug="Ab3dEf7" />);
    expect(screen.getByRole("heading", { level: 1, name: "Giulia" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\+39 333 1/ })).toHaveAttribute("href", "tel:+393331");
    expect(screen.getByRole("link", { name: /Salva/ })).toHaveAttribute(
      "href",
      "/api/public/pages/Ab3dEf7/vcard/c.vcf",
    );
    expect(screen.getByRole("link", { name: "Creato con Vorya QR" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Segnala abuso" })).toHaveAttribute(
      "href",
      "/report?slug=Ab3dEf7",
    );
  });

  it("disables the vcf download in the editor preview and hides branding when off", () => {
    render(
      <PageRenderer
        page={{ ...page, settings: { ...page.settings, show_branding: false } }}
        files={{}}
        slug={null}
        preview
      />,
    );
    expect(screen.getByText("Salva").closest("a")).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText("Creato con Vorya QR")).not.toBeInTheDocument();
  });
});

describe("type forms", () => {
  it("shows locked types with the plan message", () => {
    render(<TypePicker value={null} allowed={["website", "vcard"]} onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /vCard(?! statica)/ })).toBeEnabled();
    expect(screen.getByRole("radio", { name: /PDF/ })).toBeDisabled();
    expect(screen.getAllByText("Disponibile nel piano Pro.").length).toBeGreaterThan(0);
  });

  it("wifi form hides the password without protection", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <StaticForm
        type="wifi"
        value={{ ssid: "", password: "", encryption: "WPA" }}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    rerender(
      <StaticForm type="wifi" value={{ ssid: "", encryption: "nopass" }} onChange={onChange} />,
    );
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });
});
