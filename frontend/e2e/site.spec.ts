import { expect, test } from "@playwright/test";

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  })
    .format(cents / 100)
    .replace(/\s/g, " ");

test("pagina prezzi coerente con la tabella dei piani (nessun prezzo nel codice)", async ({
  page,
  request,
}) => {
  const data = await (await request.get("/api/public/plans")).json();
  await page.goto("/prezzi");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Un piano per ogni attività");
  const text = (await page.locator("main").innerText()).replace(/\s/g, " ");
  for (const plan of data.plans) {
    await expect(page.getByRole("region", { name: `Piano ${plan.name}` })).toBeVisible();
    for (const price of Object.values(plan.prices) as {
      amount_cents: number;
      currency: string;
    }[]) {
      // The monthly price is on screen; the yearly one appears when the toggle is switched.
      if (plan.prices.monthly === price)
        expect(text).toContain(money(price.amount_cents, price.currency));
    }
  }
  // The comparison table has one column per plan and the guarantee is visible.
  await expect(page.getByRole("columnheader")).toHaveCount(data.plans.length + 1);
  await expect(
    page.getByRole("heading", { name: /Cosa succede se smetti di pagare/ }),
  ).toBeVisible();
  // Yearly toggle: the numbers change to the yearly prices of the table.
  const yearly = data.plans.find((p: { prices: { yearly?: unknown } }) => p.prices.yearly);
  if (yearly) {
    await page.getByRole("radio", { name: /Annuale/ }).click();
    const after = (await page.locator("main").innerText()).replace(/\s/g, " ");
    expect(after).toContain(
      money(yearly.prices.yearly.amount_cents, yearly.prices.yearly.currency),
    );
  }
});

test.describe("navigazione del sito da mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("menu, landing dei tipi, soluzioni e footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Stampa il QR una volta");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "Apri il menu" }).click();
    await page.locator("summary", { hasText: "Tipi di QR" }).click();
    await page.getByRole("link", { name: "Wi-Fi", exact: true }).first().click();
    await expect(page).toHaveURL(/\/qr-code\/wifi$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("QR code per il Wi-Fi");
    await expect(page.getByRole("tab", { name: "Wi-Fi", selected: true })).toBeVisible();

    await page.getByRole("button", { name: "Apri il menu" }).click();
    await page.locator("summary", { hasText: "Soluzioni" }).click();
    await page.getByRole("link", { name: "Ristoranti e bar" }).first().click();
    await expect(page).toHaveURL(/\/soluzioni\/ristoranti$/);

    // The footer links every landing page.
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Carta dei vini", exact: true })
      .click();
    await expect(page).toHaveURL(/\/qr-code\/carta-dei-vini$/);
    const after = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(after).toBeLessThanOrEqual(0);
  });
});

test("striscia promo, piano in evidenza, interruttore annuale, menu famiglia e FAQ", async ({
  page,
  request,
}) => {
  const offer = await (await request.get("/api/public/site/offer")).json();
  await page.goto("/prezzi");
  const strip = page.getByRole("complementary", { name: "Offerta" });
  await expect(strip).toContainText(String(offer.trial.days));
  await expect(strip).toContainText(offer.trial.plan_name);
  const featured = page.getByRole("region", {
    name: new RegExp(`Piano ${offer.featured_plan}`, "i"),
  });
  await expect(featured).toContainText(offer.featured_label);
  const plans = await (await request.get("/api/public/plans")).json();
  if (plans.plans.some((p: { prices: { yearly?: unknown } }) => p.prices.yearly)) {
    await expect(page.getByText(offer.yearly_label)).toBeVisible();
    await page.getByRole("radio", { name: /Annuale/ }).click();
    await expect(page.getByRole("radio", { name: /Annuale/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  }

  await page.getByRole("button", { name: "Le app della famiglia Vorya" }).click();
  await expect(page.getByRole("link", { name: /Vorya Sign/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Tutte le app Vorya/ })).toBeVisible();

  await page.goto("/faq");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Risposte chiare");
  await page.getByText("Salvate gli indirizzi IP di chi scansiona?").click();
  await expect(page.getByText("Nelle statistiche vedi scansioni")).toBeVisible();
});

test("robots, sitemap e metadati SEO", async ({ request, page }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap:");
  expect(robots).toContain("Disallow: /app/");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/prezzi", "/faq", "/genera", "/qr-code/menu", "/soluzioni/cantine"])
    expect(sitemap).toContain(path);
  expect(sitemap).not.toContain("/guide/qr-statico-o-dinamico"); // drafts stay out
  await page.goto("/prezzi");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/prezzi$/);
  await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
  const og = await request.get("/og?title=Prova");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");
});
