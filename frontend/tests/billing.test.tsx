import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BillingBanner } from "@/components/billing/BillingBanner";
import { validateProfile, EMPTY_PROFILE } from "@/components/billing/BillingProfileForm";
import { PlanCards } from "@/components/billing/PlanCards";
import {
  featureLines,
  formatMoney,
  yearlySaving,
  type BillingInfo,
  type PlanCardData,
} from "@/lib/billing";
import { validTaxCode, validVat } from "@/lib/fiscal";

const features = {
  custom_back_half: false, max_aliases_per_link: null, link_rules: false, utm_templates: false,
  max_bulk_rows: 0, version_history: false, menu_type: false, allowed_types: ["url"],
}; // prettier-ignore

const START: PlanCardData = {
  id: "start",
  name: "Start",
  description: "",
  features,
  limits: { static_qr: 10, dynamic_qr: 5, companies: 1 },
  prices: { monthly: { amount_cents: 900, currency: "eur" } },
};
const PRO: PlanCardData = {
  id: "pro", name: "Pro", description: "Per chi cresce",
  features: { ...features, custom_back_half: true, max_aliases_per_link: 3, link_rules: true, max_bulk_rows: 500, menu_type: true },
  limits: { static_qr: null, dynamic_qr: 50, companies: 3 },
  prices: {
    monthly: { amount_cents: 2900, currency: "eur" },
    yearly: { amount_cents: 29000, currency: "eur" },
  },
}; // prettier-ignore
const LABELS = { url: "Sito web" };

describe("fiscal validation", () => {
  it("accepts valid VAT numbers and tax codes, rejects wrong checksums", () => {
    expect(validVat("12345678903")).toBe(true);
    expect(validVat("12345678901")).toBe(false);
    expect(validTaxCode("RSSMRA85T10A562S")).toBe(true);
    expect(validTaxCode("RSSMRA85T10A562X")).toBe(false);
    expect(validTaxCode("12345678903")).toBe(true);
  });

  it("requires VAT or tax code, SDI or PEC, and a coherent address for Italy", () => {
    const base = { ...EMPTY_PROFILE, legal_name: "Rossi Srl", address: "Via Roma 1", zip: "20100", city: "Milano", province: "MI", vat: "12345678903", sdi_code: "ABC1234" };
    expect(validateProfile(base)).toEqual({});
    expect(validateProfile({ ...base, vat: "", tax_code: "" }).vat).toBeTruthy();
    expect(validateProfile({ ...base, vat: "12345678901" }).vat).toMatch(/non valida/);
    expect(validateProfile({ ...base, sdi_code: "", pec: "" }).sdi_code).toBeTruthy();
    expect(validateProfile({ ...base, zip: "201" }).zip).toBeTruthy();
    expect(validateProfile({ ...base, country: "DE", zip: "10115", province: "", sdi_code: "" })).toEqual({});
  }); // prettier-ignore
});

describe("plan data", () => {
  it("formats money and the yearly saving", () => {
    expect(formatMoney(2900)).toContain("29");
    expect(yearlySaving(PRO.prices)).toBe(17);
    expect(yearlySaving(START.prices)).toBe(0);
  });

  it("builds feature lines from the plan itself, nothing hard-coded", () => {
    const lines = featureLines(PRO, LABELS);
    expect(lines).toContain("Menu e carta dei vini");
    expect(lines).toContain("Fino a 3 back-half per link");
    expect(lines).toContain("Creazione da CSV fino a 500 righe");
    expect(lines).toContain("QR statici illimitati");
    expect(featureLines(START, LABELS).join()).not.toMatch(/Menu|CSV|back-half/);
  });
});

describe("PlanCards", () => {
  it("switches to the yearly price and marks the current plan", async () => {
    render(
      <PlanCards plans={[START, PRO]} labels={LABELS} currentPlanId="pro" onChoose={vi.fn()} />,
    );
    expect(screen.getAllByText(/\/ mese/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("radio", { name: /Annuale/ }));
    expect(screen.getByText(/290/)).toBeInTheDocument();
    expect(screen.getByText("Il tuo piano")).toBeInTheDocument();
  });

  it("does not offer to buy a plan with no price for the chosen cycle", async () => {
    const choose = vi.fn();
    render(<PlanCards plans={[START, PRO]} labels={LABELS} onChoose={choose} />);
    await userEvent.click(screen.getByRole("radio", { name: /Annuale/ }));
    expect(screen.getByRole("button", { name: "Scegli Start" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Scegli Pro" }));
    expect(choose).toHaveBeenCalledWith(PRO, "yearly");
  });
});

describe("BillingBanner", () => {
  const info = (patch: Partial<BillingInfo>) => ({ state: "active", ...patch }) as BillingInfo;
  it("explains past_due with the grace deadline and canceled with the redirect window", () => {
    const { rerender, container } = render(<BillingBanner info={info({ state: "active" })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(
      <BillingBanner info={info({ state: "past_due", grace_until: "2030-01-10T00:00:00Z" })} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/non è andato a buon fine/);
    rerender(
      <BillingBanner info={info({ state: "canceled", redirects_until: "2030-02-10T00:00:00Z" })} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/continuano a funzionare/);
  });
});
